"use server"

import { createCustomerSchema, firstErrorOf, normalizePhone } from "@lib/customer-schema"

export const createCustomerAction = async (formData: any) => {
    const getVal = (key1: string, key2?: string) => {
        if (!formData) return undefined
        if (formData instanceof FormData) {
            return (formData.get(key1) || (key2 ? formData.get(key2) : undefined) || undefined) as string | undefined
        }
        return formData[key1] ?? (key2 ? formData[key2] : undefined) ?? undefined
    }

    // La tabla manda el teléfono como un único texto; un formulario con PhoneInput
    // suelto mandaría indicativo y número por separado. Aceptamos ambas formas.
    const getPhone = () => {
        const single = getVal('Teléfono') || getVal('phone')
        if (single) return single

        const number = getVal('celular_numero')
        return number ? `${getVal('celular_codigo') || "+57"} ${number}` : ""
    }

    const raw = {
        email: getVal('Correo', 'email') ?? "",
        password: getVal('password', 'Contraseña') || "123456",
        username: getVal('Nombre', 'username') || getVal('name') || "",
        rol: getVal('rol', 'Rol') || "user",
        phone: getPhone(),
    }

    const data = createCustomerSchema.safeParse(raw)

    if (!data.success) return firstErrorOf(data.error)

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()

    const metadata: Record<string, string> = {
        username: data.data.username,
        role: data.data.rol || "user",
    }
    // Se guarda normalizado ("+57 3001234567"), no el texto tal cual se escribió.
    const phone = normalizePhone(data.data.phone)
    if (phone) {
        metadata.phone = phone
    }

    const password = data.data.password || "123456"

    const { error } = await supabase.auth.signUp({
        email: data.data.email,
        password: password,
        options: { data: metadata },
    })

    if (error) {
        return error.message
    }

    // Devolvemos la fila ya creada para que la tabla la pinte sin recargar el resto.
    const { formatPhoneNumber } = await import("@lib/phone")
    const { formatColombianDate } = await import("@lib/date")

    const { data: created } = await supabase
        .schema("main")
        .from("client")
        .select("id,username,email,phone,created_at")
        .eq("email", data.data.email)
        .eq("exist", true)
        .maybeSingle()

    const fecha = created?.created_at ? formatColombianDate(created.created_at) : "error"

    return {
        customer: {
            Id: created?.id,
            Nombre: created?.username ?? data.data.username,
            Correo: created?.email ?? data.data.email,
            Teléfono: formatPhoneNumber(created?.phone ?? metadata.phone ?? ""),
            "Fecha de Creación": fecha === "error" ? "--" : fecha,
        },
    }
}
