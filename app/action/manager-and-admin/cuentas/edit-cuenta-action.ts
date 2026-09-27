"use server"

import { revalidatePath } from "next/cache"
import { editCuentaSchema, firstErrorOfCuenta } from "@lib/cuenta-schema"

/**
 * Plataforma, correo y contraseña son la identidad de la cuenta real del proveedor: no se editan.
 * El estado de venta tampoco vive acá — es de cada perfil (ver /administrar/perfiles).
 */
export async function editCuentaAction(formData: {
    id: number
    fecha_vencimiento?: string
    costo?: number | string
    perfil_max: number | string
}): Promise<string | null> {
    if (!formData.id) return "Id no encontrado"

    const data = editCuentaSchema.safeParse(formData)
    if (!data.success) return firstErrorOfCuenta(data.error)

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()

    const { error } = await supabase
        .schema("business")
        .from("account")
        .update({
            fecha_vencimiento: data.data.fecha_vencimiento,
            costo: data.data.costo,
            perfil_max: data.data.perfil_max,
        })
        .eq("id", formData.id)

    if (error) return "Error al actualizar la cuenta."

    revalidatePath("/administrar/cuentas")
    return null
}
