"use server"

import { revalidatePath } from "next/cache"
import { createProductoSchema, firstErrorOfProducto } from "@lib/producto-schema"
import { scrapeLicenciasActivas } from "@lib/scrape-licencias"
import { notificar } from "@lib/notify"
import type { ProductoRow } from "@action/manager-and-admin/productos/get-all-productos-action"

export async function createProductoAction(formData: {
    platform_id: number | string
    access_type: string
    precio_venta: number | string
}): Promise<{ producto: ProductoRow } | string> {
    const data = createProductoSchema.safeParse(formData)
    if (!data.success) return firstErrorOfProducto(data.error)

    const base = process.env.PLATFORM_URL
    const email = process.env.PLATFORM_EMAIL
    const password = process.env.PLATFORM_PASSWORD
    const encKey = process.env.ACCOUNT_ENC_KEY
    if (!base || !email || !password || !encKey) return "Falta configuración del proveedor en el servidor."

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()

    const { data: platform, error: platformError } = await supabase
        .schema("business")
        .from("platform")
        .select("id,nombre")
        .eq("id", data.data.platform_id)
        .eq("exist", true)
        .maybeSingle()
    if (platformError) return "Error al verificar la plataforma."
    if (!platform) return "Plataforma no encontrada."

    // Nunca confiar en que el cliente solo mandó opciones del selector filtrado: se vuelve a escanear
    // el proveedor y solo se dejan pasar licencias activas y vigentes hoy para esa plataforma+acceso.
    let licencias
    try {
        licencias = await scrapeLicenciasActivas({ base, email, password }, [platform.nombre])
    } catch (e) {
        await notificar({ origen: "scraping", tipo: "error", titulo: "Falló el escaneo de licencias del proveedor", mensaje: e })
        return "No pudimos verificar tus licencias en el proveedor. Intenta de nuevo."
    }
    const propias = licencias.filter((l) => l.platformNombre === platform.nombre && l.access === data.data.access_type)
    if (propias.length === 0) return "No tenés ninguna licencia activa de este producto en el proveedor."

    // El costo es solo referencial (último precio scrapeado del catálogo público); si el proveedor
    // ya no lo vende no bloquea la creación, porque la licencia comprada sigue siendo tuya.
    const { data: oferta } = await supabase
        .schema("business")
        .from("oferta_proveedor")
        .select("costo")
        .eq("platform_id", data.data.platform_id)
        .eq("access_type", data.data.access_type)
        .maybeSingle()

    // El unique(platform_id, access_type) solo protege filas activas (exist=true): si ya se
    // "eliminó" (soft-delete) un producto de esta combinación, se revive en vez de intentar un
    // insert que chocaría con esa fila vieja para siempre.
    const { data: previo, error: previoError } = await supabase
        .schema("business")
        .from("producto")
        .select("id")
        .eq("platform_id", data.data.platform_id)
        .eq("access_type", data.data.access_type)
        .eq("exist", false)
        .maybeSingle()
    if (previoError) return "Error al verificar productos existentes."

    const upsert = previo
        ? supabase
              .schema("business")
              .from("producto")
              .update({ costo: oferta?.costo ?? null, precio_venta: data.data.precio_venta, exist: true })
              .eq("id", previo.id)
        : supabase
              .schema("business")
              .from("producto")
              .insert({
                  platform_id: data.data.platform_id,
                  access_type: data.data.access_type,
                  costo: oferta?.costo ?? null,
                  precio_venta: data.data.precio_venta,
              })

    const { data: created, error } = await upsert
        .select("id,platform_id,access_type,costo,precio_venta,exist,platform:platform_id(nombre,categoria:category_id(nombre))")
        .single()

    if (error) {
        // unique(platform_id, access_type) where exist
        if (error.code === "23505") return "Ya existe un producto con esa plataforma y tipo de acceso."
        return "Error al crear el producto."
    }

    // El producto recién creado exige precio_venta, así que ya cumple lo necesario para aparecer en
    // la Tienda (catalogo_disponible) — pero esa vista también exige account+profile reales. Se
    // registran acá, uno por cada licencia activa detectada, para que el stock ya comprado quede
    // visible al cliente de inmediato en vez de quedar "huérfano".
    //
    // Idempotencia: esto puede correr más de una vez para las MISMAS licencias (ej. borrar y volver a
    // crear el producto revive la fila y vuelve a escanear el proveedor). Sin este chequeo, cada corrida
    // insertaba una cuenta nueva para una licencia ya registrada -> el mismo perfil aparecía duplicado
    // en catalogo_disponible. El email es el identificador real de la licencia en el proveedor.
    const { data: cuentasExistentes } = await supabase
        .schema("business")
        .from("account")
        .select("email")
        .eq("platform_id", data.data.platform_id)
        .eq("access_type", data.data.access_type)
        .eq("exist", true)
    const emailsRegistrados = new Set((cuentasExistentes ?? []).map((a) => a.email))

    for (const l of propias) {
        if (emailsRegistrados.has(l.email)) continue

        const { data: encPassword, error: encError } = await supabase
            .schema("business")
            .rpc("encrypt_account_password", { password: l.password, enc_key: encKey })
        if (encError || !encPassword) continue

        const { data: account, error: accountError } = await supabase
            .schema("business")
            .from("account")
            .insert({
                platform_id: data.data.platform_id,
                access_type: data.data.access_type,
                email: l.email,
                password_enc: encPassword,
                perfil_max: 1,
                fecha_vencimiento: l.validoHasta.toISOString().slice(0, 10),
                costo: oferta?.costo ?? null,
            })
            .select("id")
            .single()
        if (accountError || !account) continue

        // precio_venta vive en business.producto (no en profile, ver 20260920120006_producto_catalog.sql):
        // catalogo_disponible lo lee del join con producto, no de esta fila.
        await supabase
            .schema("business")
            .from("profile")
            .insert({
                account_id: account.id,
                nombre_perfil: l.perfil,
                pin: l.pin,
                estado: "disponible",
            })
    }

    // El producto recién creado (con su account/profile) cambia lo que ve el manager en /productos
    // y lo que ve el cliente en /tienda — refrescar ambas rutas para que no dependan de un F5 manual.
    revalidatePath("/administrar/productos")
    revalidatePath("/administrar/tienda")

    const platformInfo = created.platform as unknown as { nombre: string; categoria: { nombre: string } | null } | null

    return {
        producto: {
            id: created.id,
            platform_id: created.platform_id,
            platform_nombre: platformInfo?.nombre ?? "--",
            categoria: platformInfo?.categoria?.nombre ?? "--",
            access_type: created.access_type,
            costo: created.costo,
            precio_venta: created.precio_venta,
            exist: created.exist,
        },
    }
}
