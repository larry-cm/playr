"use server"

import { editPrecioVentaSchema, firstErrorOfProducto } from "@lib/producto-schema"

export async function editProductoPreciosAction(formData: {
    id: number
    precio_venta: number | string
}): Promise<string | null> {
    if (!formData.id) return "Id no encontrado"

    const data = editPrecioVentaSchema.safeParse(formData)
    if (!data.success) return firstErrorOfProducto(data.error)

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()

    const { error } = await supabase
        .schema("business")
        .from("producto")
        .update({ precio_venta: data.data.precio_venta })
        .eq("id", formData.id)

    if (error) return "Error al actualizar el producto."
    return null
}
