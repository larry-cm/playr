"use server"

import { getRoleUser } from "@action/get-role-action"
import { cfgProveedor, conectar, leerLicencias } from "@lib/bodega/proveedor"
import { claveDeCuenta } from "@lib/bodega/entrega"
import { notificar } from "@lib/notify"

export type ClavePerfil = { ok: true; password: string } | { ok: false; error: string }

/**
 * Contraseña de la cuenta del perfil, leída EN VIVO de "Mis licencias" del proveedor (no de password_enc): así se ve la
 * vigente aunque el proveedor la haya cambiado después de la compra. Solo admin/manager, y nunca viaja en el listado:
 * la UI la pide al abrir Ver o Editar.
 */
export async function getClavePerfilAction(perfilId: number): Promise<ClavePerfil> {
    const role = await getRoleUser()
    if (role !== "admin" && role !== "manager") return { ok: false, error: "No tienes permiso para ver contraseñas." }
    if (!Number.isInteger(perfilId)) return { ok: false, error: "Id no encontrado" }

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    const { data, error } = await supabase
        .schema("business")
        .from("profile")
        .select("nombre_perfil,account:account_id!inner(email)")
        .eq("id", perfilId)
        .maybeSingle()
    const email = (data?.account as unknown as { email: string } | null)?.email
    if (error || !data || !email) return { ok: false, error: "No se encontró el perfil." }

    const cfg = cfgProveedor()
    if (!cfg) return { ok: false, error: "Falta configuración del proveedor en el servidor." }

    try {
        const password = claveDeCuenta(await leerLicencias(await conectar(cfg)), email, data.nombre_perfil)
        return password ? { ok: true, password } : { ok: false, error: "El proveedor no tiene una licencia con este correo." }
    } catch (e) {
        await notificar({ origen: "scraping", tipo: "error", titulo: "No se pudo leer las licencias del proveedor", mensaje: e })
        return { ok: false, error: "No se pudo consultar el proveedor." }
    }
}
