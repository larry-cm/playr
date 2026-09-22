"use server"

import { revalidatePath } from "next/cache"

/**
 * Soft-delete de la cuenta y, con ella, de sus perfiles: sin el login ya no hay dónde venderlos, y
 * si quedaran vivos seguirían apareciendo en /administrar/perfiles y en la Tienda como stock falso.
 */
export async function deleteCuentaAction(formData: { id: number }): Promise<string | null> {
    if (!formData.id) return "Id no encontrado"

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()

    const { error } = await supabase
        .schema("business")
        .from("account")
        .update({ exist: false })
        .eq("id", formData.id)
    if (error) return "Error al eliminar la cuenta."

    await supabase
        .schema("business")
        .from("profile")
        .update({ exist: false })
        .eq("account_id", formData.id)

    revalidatePath("/administrar/cuentas")
    revalidatePath("/administrar/perfiles")
    revalidatePath("/administrar/tienda")
    revalidatePath("/administrar")
    return null
}
