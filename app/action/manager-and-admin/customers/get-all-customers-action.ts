"use server"

import { esStaff } from "@lib/auth"

export async function getAllCustomersAction() {
    if (!(await esStaff())) return null

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
        return data.map((customer) => ({
            Id: customer.id,
            Nombre: customer.username,
            Correo: customer.email,
            Teléfono: formatPhoneNumber(customer.phone),
            "Fecha de Creación": safeDate(customer.created_at)
        }))
    } catch {
        return []
    }

}