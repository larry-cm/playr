import { z } from "zod"
import { getRoleUser } from "@action/get-role-action"

/** Mensaje único cuando una acción de staff la llama alguien sin permiso. */
export const SIN_PERMISO = "No tienes permiso para esta acción."

/**
 * Las server actions son endpoints POST públicos: ocultar el botón no basta. Toda acción de
 * manager-and-admin debe empezar con esto (además de la RLS de la base).
 */
export async function esStaff(): Promise<boolean> {
    const role = await getRoleUser()
    return role === "admin" || role === "manager"
}

/**
 * Para editar o dar de baja a un usuario: el staff gestiona clientes, pero solo un admin toca a otro
 * staff, y nadie se da de baja a sí mismo. Devuelve el mensaje de error o null si puede.
 */
export async function puedeGestionarUsuario(id: unknown, { baja = false } = {}): Promise<string | null> {
    const role = await getRoleUser()
    if (role !== "admin" && role !== "manager") return SIN_PERMISO
    if (!z.uuid().safeParse(id).success) return "Id no encontrado"

    const { getUsuario } = await import("@lib/supabase/server")
    const { user, supabase } = await getUsuario()
    if (baja && user?.id === id) return "No puedes darte de baja a ti mismo."

    const { data, error } = await supabase
        .schema("security")
        .from("user_role")
        .select("role:role_id(nombre)")
        .eq("auth_user_id", id as string)
        .maybeSingle<{ role: { nombre: string } | null }>()
    if (error) return "No se pudo verificar el usuario."
    const objetivo = data?.role?.nombre
    if ((objetivo === "admin" || objetivo === "manager") && role !== "admin") return SIN_PERMISO
    return null
}
