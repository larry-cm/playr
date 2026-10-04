"use server"

import { resolverClaves, type ClavePerfil } from "@lib/claves"
import { createSupabaseAdmin } from "@lib/supabase/admin"

export interface AccesoPerfil {
    profile_id: number
    platform_nombre: string
    /** true = cuenta completa: se entrega el correo y la contraseña de la cuenta, no los de un perfil. */
    completa: boolean
    perfil_nombre: string
    pin: string | null
    email: string
    clave: ClavePerfil
}

export type AccesosResult = { ok: true; accesos: AccesoPerfil[] } | { ok: false; error: string }

type Fila = {
    id: number
    nombre_perfil: string
    pin: string | null
    email: string | null
    account_id: number
    account: { email: string; access_type: string; fecha_vencimiento: string | null; platform: { nombre: string } }
}

/**
 * Datos de acceso de un pedido APROBADO del cliente que llama. Primero se verifica con su sesión (RLS) que el pedido
 * es suyo y está aprobado; recién ahí se leen perfiles y contraseñas con service_role, porque el cliente no puede leer
 * profile/account. Las contraseñas salen igual que en el panel (resolverClaves): la editada o la vigente del proveedor.
 * Solo se entregan los perfiles que el pedido conserva: ligados a él (vendido_pedido_id, se suelta si el perfil vuelve
 * a la venta), activos, no suspendidos y con la cuenta sin vencer.
 */
export async function getAccesosPedidoAction(pedidoId: number): Promise<AccesosResult> {
    if (!Number.isInteger(pedidoId)) return { ok: false, error: "Pedido no encontrado." }

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." }

    const { data: cliente } = await supabase.schema("security").from("client").select("exist").eq("id", user.id).maybeSingle()
    if (cliente?.exist === false) return { ok: false, error: "Tu cuenta está dada de baja. Contacta a soporte." }

    const { data: pedido } = await supabase
        .schema("business")
        .from("pedido")
        .select("id,estado,pedido_item(profile_id)")
        .eq("id", pedidoId)
        .eq("cliente_id", user.id)
        .maybeSingle()
    if (!pedido) return { ok: false, error: "Pedido no encontrado." }
    if (pedido.estado !== "aprobado") return { ok: false, error: "Los accesos se muestran cuando el pago está aprobado." }

    const admin = createSupabaseAdmin()
    if (!admin) return { ok: false, error: "No se pudieron cargar los accesos. Contacta a soporte." }

    const ids = (pedido.pedido_item ?? []).map((i) => i.profile_id)
    const { data: filas, error } = await admin
        .schema("business")
        .from("profile")
        .select("id,nombre_perfil,pin,email,account_id,account:account_id!inner(email,access_type,fecha_vencimiento,platform:platform_id!inner(nombre))")
        .in("id", ids)
        .eq("vendido_pedido_id", pedido.id)
        .eq("exist", true)
        .in("estado", ["vendido", "en_soporte"])
        .order("id", { ascending: true })
        .returns<Fila[]>()
    if (error || !filas) {
        console.error("getAccesosPedidoAction:", error?.message)
        return { ok: false, error: "No se pudieron cargar los accesos. Inténtalo de nuevo." }
    }
    const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
    const data = filas.filter((f) => !f.account.fecha_vencimiento || f.account.fecha_vencimiento >= hoy)
    if (data.length === 0) return { ok: false, error: "Este pedido ya no tiene accesos vigentes. Contacta a soporte." }

    // Una lectura de claves por cuenta (resolverClaves consulta el proveedor una sola vez por llamada).
    const porCuenta = new Map<number, Fila[]>()
    for (const f of data) porCuenta.set(f.account_id, [...(porCuenta.get(f.account_id) ?? []), f])

    const accesos: AccesoPerfil[] = []
    await Promise.all(
        [...porCuenta].map(async ([cuentaId, filas]) => {
            const completa = filas[0].account.access_type === "completa"
            const claves = await resolverClaves(admin, { cuentaId, perfilIds: filas.map((f) => f.id), conCuenta: completa })
            for (const f of filas) {
                accesos.push({
                    profile_id: f.id,
                    platform_nombre: f.account.platform.nombre,
                    completa,
                    perfil_nombre: f.nombre_perfil,
                    pin: f.pin,
                    email: completa ? f.account.email : (f.email ?? f.account.email),
                    clave: (completa ? claves.cuenta : claves.perfiles[f.id]) ?? { ok: false, error: "No se pudo leer la contraseña." },
                })
            }
        }),
    )

    return { ok: true, accesos: accesos.sort((a, b) => a.profile_id - b.profile_id) }
}
