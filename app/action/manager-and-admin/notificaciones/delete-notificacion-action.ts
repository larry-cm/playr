"use server"

import { createSupabase } from "@lib/supabase/server"

// Soft-delete (exist=false): la fila sigue en la DB, solo deja de mostrarse.
export async function deleteNotificacionAction(formData: { id: number }): Promise<string | null> {
    if (!formData.id) return "Id no encontrado"

    const supabase = await createSupabase()
    const { error } = await supabase
        .schema("business")
        .from("notificacion")
        .update({ exist: false })
        .eq("id", formData.id)

    if (error) return "Error al eliminar la notificación."
    return null
}
