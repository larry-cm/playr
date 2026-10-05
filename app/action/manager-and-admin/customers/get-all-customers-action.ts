"use server"

import { esAdmin } from "@lib/auth"
import { ETIQUETA_ROL } from "@lib/customer-schema"

export async function getAllCustomersAction() {
    if (!(await esAdmin())) return null

    const { createSupabase } = await import("@lib/supabase/server")
    const { formatColombianDate } = await import("@lib/date")
    const { formatPhoneNumber } = await import("@lib/phone")

    // Una fecha no parseable no debe ocultar al cliente del listado.
    const safeDate = (value: string | null) => {
        const formatted = formatColombianDate(value ?? "")
        return formatted === "error" ? "--" : formatted
    }

    const supabase = await createSupabase()
    try {
        const { data, error } = await supabase
            .schema("security")
            .from("client")
            .select("id,username,email,phone,created_at")
            .eq("exist", true)

        if (error) {
            return null
        }
        // El rol vive en security.user_role (sin relación declarada con client): se cruza acá.
        const { data: roles, error: errorRoles } = await supabase
            .schema("security")
            .from("user_role")
            .select("auth_user_id, role:role_id(nombre)")
            .returns<{ auth_user_id: string; role: { nombre: string } | null }[]>()
        if (errorRoles) return null
        const rolDe = new Map(roles.map((r) => [r.auth_user_id, r.role?.nombre ?? "user"]))
        return data.map((customer) => ({
            Id: customer.id,
            Nombre: customer.username,
            Correo: customer.email,
            Teléfono: formatPhoneNumber(customer.phone),
            Tipo: ETIQUETA_ROL[rolDe.get(customer.id) ?? "user"] ?? "Cliente",
            "Fecha de Creación": safeDate(customer.created_at)
        }))
    } catch {
        return []
    }

}