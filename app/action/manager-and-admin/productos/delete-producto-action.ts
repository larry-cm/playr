"use server"

import { esStaff, SIN_PERMISO } from "@lib/auth"
import { revalidatePath } from "next/cache"

export async function deleteProductoAction(formData: { id: number }): Promise<string | null> {
    if (!(await esStaff())) return SIN_PERMISO

    if (!formData.id) return "Id no encontrado"

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()

    const { error } = await supabase
        .schema("business")
        .from("producto")
        .update({ exist: false })
        .eq("id", formData.id)

    if (error) return "Error al eliminar el producto."

    revalidatePath("/administrar/tienda")
    return null
}
