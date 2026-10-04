"use server"

import { puedeGestionarUsuario } from "@lib/auth"
import { createSupabaseAdmin } from "@lib/supabase/admin"

// Dar de baja no es solo ocultarlo de la tabla: se bloquea su login en Auth (no puede entrar ni renovar
// la sesión) y getRoleUser trata a un cliente con exist=false como sin sesión.
const BLOQUEO_INDEFINIDO = "876000h"

export async function deleteCustomerAction(formData: { id: string }) {
    const noPuede = await puedeGestionarUsuario(formData?.id, { baja: true })
    if (noPuede) return noPuede
    const { id } = formData

    const admin = createSupabaseAdmin()
    if (!admin) return "Falta la configuración del servidor para dar de baja usuarios."
    try {
        const { error: banError } = await admin.auth.admin.updateUserById(id, { ban_duration: BLOQUEO_INDEFINIDO })
        if (banError) return "No se pudo bloquear el acceso del cliente."

        const { error } = await admin.schema("security").from("client").update({ exist: false }).eq("id", id)
        if (!error) return null
        return "Error al eliminar el cliente"
    } catch {
        return "Error al intentar eliminar el cliente"
    }
}
