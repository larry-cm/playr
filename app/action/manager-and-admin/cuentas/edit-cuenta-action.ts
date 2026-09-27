"use server"

import { revalidatePath } from "next/cache"
import { getRoleUser } from "@action/get-role-action"
import { editCuentaSchema, firstErrorOfCuenta } from "@lib/cuenta-schema"

/**
 * Solo el correo se edita. Plataforma, vencimiento, costo y cupo de perfiles vienen de la compra; la contraseña se lee
 * en vivo del proveedor por correo, así que el correo debe coincidir con el de "Mis licencias".
 * El estado de venta no vive acá — es de cada perfil (ver /administrar/perfiles).
 */
export async function editCuentaAction(formData: { id: number; email: string }): Promise<string | null> {
    const role = await getRoleUser()
    if (role !== "admin" && role !== "manager") return "No tienes permiso para editar cuentas."
    if (!formData.id) return "Id no encontrado"

    const data = editCuentaSchema.safeParse(formData)
    if (!data.success) return firstErrorOfCuenta(data.error)

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()

    const { error } = await supabase
        .schema("business")
        .from("account")
        .update({ email: data.data.email })
        .eq("id", formData.id)

    if (error) return error.code === "23505" ? "Ya existe otra cuenta con ese correo en esta plataforma." : "Error al actualizar la cuenta."

    revalidatePath("/administrar/cuentas")
    revalidatePath("/administrar/perfiles")
    return null
}
