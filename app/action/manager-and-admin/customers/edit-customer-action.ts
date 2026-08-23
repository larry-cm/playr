"use server"

import { customerBaseSchema, firstErrorOf, normalizePhone } from "@lib/customer-schema"

export async function editCustomerAction(formData: any) {
    const { email, name, phone, id } = formData
    if (!id) {
        return "Id no encontrado"
    }

    // Mismo esquema que al crear: editar no puede ser la puerta de atrás.
    const data = customerBaseSchema.safeParse({
        username: name ?? "",
        email: email ?? "",
        phone: phone ?? "",
    })

    if (!data.success) return firstErrorOf(data.error)

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    try {
        const { error } = await supabase
            .schema("main")
            .from("client")
            .update({
                username: data.data.username,
                email: data.data.email,
                // La tabla muestra el teléfono agrupado; se guarda normalizado.
                phone: normalizePhone(data.data.phone),
            })
            .eq("id", id)
        if (!error) return null
        return "Error al editar el cliente"
    } catch {
        return "Error al intentar editar el cliente"
    }
}
