"use server"

import { esStaff, SIN_PERMISO } from "@lib/auth"
import { revalidatePath } from "next/cache"

/** Soft-delete (exist=false), como en el resto del proyecto: la fila queda, deja de contarse y de venderse. */
export async function deletePerfilAction(formData: { id: number }): Promise<string | null> {
    if (!(await esStaff())) return SIN_PERMISO

    if (!formData.id) return "Id no encontrado"

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()

    const { error } = await supabase
        .schema("business")
        .from("profile")
        .update({ exist: false })
        .eq("id", formData.id)

    if (error) return "Error al eliminar el perfil."

    revalidatePath("/administrar/perfiles")
    revalidatePath("/administrar/cuentas")
    revalidatePath("/administrar/tienda")
    revalidatePath("/administrar")
    return null
}
