"use server"

import { esStaff, SIN_PERMISO } from "@lib/auth"
import { createSupabase } from "@lib/supabase/server"

// Soft-delete (exist=false) de toda la bandeja hasta `hastaId` (la más nueva que el usuario tenía cargada):
// un aviso que llegue mientras confirma no se borra sin haberlo visto. Incluye las que no entraron en las 100 leídas.
export async function clearNotificacionesAction(formData: { hastaId: number }): Promise<string | null> {
    if (!(await esStaff())) return SIN_PERMISO

    if (!Number.isInteger(formData.hastaId) || formData.hastaId <= 0) return "Id no encontrado"

    const supabase = await createSupabase()
    const { error } = await supabase
        .schema("business")
        .from("notificacion")
        .update({ exist: false })
        .eq("exist", true)
        .lte("id", formData.hastaId)

    if (error) return "Error al limpiar las notificaciones."
    return null
}
