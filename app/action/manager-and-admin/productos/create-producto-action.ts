"use server"

import { createProductoSchema, firstErrorOfProducto } from "@lib/producto-schema"
import { scrapeLicenciasActivas } from "@lib/scrape-licencias"
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
    } catch {
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

    const { data: created, error } = await supabase
        .schema("business")
        .from("producto")
        .insert({
            platform_id: data.data.platform_id,
            access_type: data.data.access_type,
            costo: oferta?.costo ?? null,
            precio_venta: data.data.precio_venta,
        })
        .select("id,platform_id,access_type,costo,precio_venta,exist,platform:platform_id(nombre,categoria:category_id(nombre))")
        .single()

    if (error) {
        // unique(platform_id, access_type)
        if (error.code === "23505") return "Ya existe un producto con esa plataforma y tipo de acceso."
        return "Error al crear el producto."
    }

    // El producto recién creado exige precio_venta, así que ya cumple lo necesario para aparecer en
    // la Tienda (catalogo_disponible) — pero esa vista también exige account+profile reales. Se
    // registran acá, uno por cada licencia activa detectada, para que el stock ya comprado quede
    // visible al cliente de inmediato en vez de quedar "huérfano".
    for (const l of propias) {
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

        await supabase
            .schema("business")
            .from("profile")
            .insert({
                account_id: account.id,
                nombre_perfil: l.perfil,
                pin: l.pin,
                precio_venta: data.data.precio_venta,
                estado: "disponible",
            })
    }

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
