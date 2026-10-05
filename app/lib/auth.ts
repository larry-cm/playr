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

/** El módulo de Clientes (listar, crear, editar, dar de baja) es solo del admin (pedido del usuario 2026-10-04). */
export async function esAdmin(): Promise<boolean> {
    return (await getRoleUser()) === "admin"
}

/**
 * Para editar o dar de baja a un usuario: solo un admin, y nadie se da de baja a sí mismo. Devuelve el
 * mensaje de error o null si puede.
 */
export async function puedeGestionarUsuario(id: unknown, { baja = false } = {}): Promise<string | null> {
    if (!(await esAdmin())) return SIN_PERMISO
    if (!z.uuid().safeParse(id).success) return "Id no encontrado"

    const { getUsuario } = await import("@lib/supabase/server")
    const { user } = await getUsuario()
    if (baja && user?.id === id) return "No puedes darte de baja a ti mismo."
    return null
}
