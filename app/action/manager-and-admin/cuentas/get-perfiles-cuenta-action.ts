"use server"

import { getRoleUser } from "@action/get-role-action"
import type { PerfilRow } from "@action/manager-and-admin/perfiles/get-all-perfiles-action"
import { resolverClaves, type ClavePerfil } from "@lib/claves"

export type PerfilDeCuenta = Pick<PerfilRow, "id" | "nombre_perfil" | "pin" | "estado"> & {
    /** Correo efectivo: el propio del perfil si se editó, si no el de la cuenta. */
    email: string
    /** true = el correo o la contraseña del perfil se editaron a mano (ya no son los de la compra). */
    editado: boolean
}

/**
 * Perfiles vivos de UNA cuenta, para el modal "Ver cuenta". Solo admin/manager (trae los PIN). null = error al leer.
 */
export async function getPerfilesCuentaAction(accountId: number): Promise<PerfilDeCuenta[] | null> {
    const role = await getRoleUser()
    if (role !== "admin" && role !== "manager") return null
    if (!Number.isInteger(accountId)) return null

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    const { data, error } = await supabase
        .schema("business")
        .from("profile")
        .select("id,nombre_perfil,pin,estado,email,password_editada_at,account:account_id!inner(email)")
        .eq("account_id", accountId)
        .eq("exist", true)
        .order("id", { ascending: true })

    if (error) return null
    return data.map((p) => ({
        id: p.id,
        nombre_perfil: p.nombre_perfil,
        pin: p.pin,
        estado: p.estado,
        email: p.email ?? (p.account as unknown as { email: string }).email,
        editado: p.email !== null || p.password_editada_at !== null,
    }))
}

/** Contraseñas de la cuenta y de cada uno de sus perfiles, con una sola lectura del proveedor. */
export async function getClavesCuentaAction(
    accountId: number,
    perfilIds: number[],
): Promise<{ cuenta: ClavePerfil; perfiles: Record<number, ClavePerfil> }> {
    const role = await getRoleUser()
    const sinPermiso: ClavePerfil = { ok: false, error: "No tienes permiso para ver contraseñas." }
    if (role !== "admin" && role !== "manager") return { cuenta: sinPermiso, perfiles: {} }

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    const r = await resolverClaves(supabase, { cuentaId: accountId, perfilIds: perfilIds.filter(Number.isInteger), conCuenta: true })
    return { cuenta: r.cuenta!, perfiles: r.perfiles }
}
