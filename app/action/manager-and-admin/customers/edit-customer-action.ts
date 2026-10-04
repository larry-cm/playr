"use server"

import { puedeGestionarUsuario } from "@lib/auth"
import { customerBaseSchema, firstErrorOf, normalizePhone } from "@lib/customer-schema"

export async function editCustomerAction(formData: { id?: unknown; email?: unknown; name?: unknown; phone?: unknown }) {
    const noPuede = await puedeGestionarUsuario(formData?.id)
    if (noPuede) return noPuede

    const text = (value: unknown) => (typeof value === "string" ? value : "")
    const [id, email, name, phone] = [formData.id, formData.email, formData.name, formData.phone].map(text)

    // Mismo esquema que al crear: editar no puede ser la puerta de atrás.
    const data = customerBaseSchema.safeParse({
        username: name,
        email,
        phone,
    })

    if (!data.success) return firstErrorOf(data.error)

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    try {
        const { error } = await supabase
            .schema("security")
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
