"use server"

import { revalidatePath } from "next/cache"

export async function deleteProductoAction(formData: { id: number }): Promise<string | null> {
    if (!formData.id) return "Id no encontrado"

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()

    const { error } = await supabase
        .schema("business")
        .from("producto")
        .update({ exist: false })
        .eq("id", formData.id)

    if (error) return "Error al eliminar el producto."

    revalidatePath("/administrar/productos")
    revalidatePath("/administrar/tienda")
    return null
}
