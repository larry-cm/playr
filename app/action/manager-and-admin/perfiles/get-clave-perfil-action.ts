"use server"

import { getRoleUser } from "@action/get-role-action"
import { resolverClaves, type ClavePerfil } from "@lib/claves"

/**
 * Contraseña de UN perfil: la editada del perfil, si no la editada de su cuenta, si no la del proveedor en vivo (ver
 * resolverClaves). Solo admin/manager, y nunca viaja en el listado: la UI la pide al abrir Ver o Editar.
 */
export async function getClavePerfilAction(perfilId: number): Promise<ClavePerfil> {
    const role = await getRoleUser()
    if (role !== "admin" && role !== "manager") return { ok: false, error: "No tienes permiso para ver contraseñas." }
    if (!Number.isInteger(perfilId)) return { ok: false, error: "Id no encontrado" }

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    const { data } = await supabase.schema("business").from("profile").select("account_id").eq("id", perfilId).eq("exist", true).maybeSingle()
    if (!data) return { ok: false, error: "No se encontró el perfil." }

    const { perfiles } = await resolverClaves(supabase, { cuentaId: data.account_id, perfilIds: [perfilId], conCuenta: false })
    return perfiles[perfilId]
}
