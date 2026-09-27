"use server"

import { revalidatePath } from "next/cache"
import { editPerfilSchema, firstErrorOfPerfil } from "@lib/perfil-schema"

/**
 * El estado decide si el perfil sigue a la venta: catalogo_disponible solo muestra 'disponible',
 * así que marcarlo vendido/suspendido/en soporte lo saca de la Tienda al instante.
 */
export async function editPerfilAction(formData: {
    id: number
    nombre_perfil: string
    pin?: string
    estado: string
}): Promise<string | null> {
    if (!formData.id) return "Id no encontrado"

    const data = editPerfilSchema.safeParse(formData)
    if (!data.success) return firstErrorOfPerfil(data.error)

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()

    const { error } = await supabase
        .schema("business")
        .from("profile")
        .update({
            nombre_perfil: data.data.nombre_perfil,
            pin: data.data.pin,
            estado: data.data.estado,
        })
        .eq("id", formData.id)

    if (error) return "Error al actualizar el perfil."

    revalidatePath("/administrar/perfiles")
    revalidatePath("/administrar/cuentas")
    revalidatePath("/administrar/tienda")
    return null
}
