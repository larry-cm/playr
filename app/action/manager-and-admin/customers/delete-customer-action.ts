"use server"

import { esStaff, SIN_PERMISO } from "@lib/auth"

export async function deleteCustomerAction(formData: { id: string }) {
    if (!(await esStaff())) return SIN_PERMISO

    const { id } = formData
    if (!id) {
        return "Id no encontrado"
    }
    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    try {
        const { error } = await supabase
            .schema("security")
            .from("client")
            .update({ exist: false })
            .eq("id", id)
        if (!error) return null
        return "Error al eliminar el cliente"
    } catch {
        return "Error al intentar eliminar el cliente"
    }
}