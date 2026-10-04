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
