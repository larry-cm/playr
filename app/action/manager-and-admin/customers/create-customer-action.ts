"use server"

import { z } from "zod"

const schema = z.object({
    email: z
        .email({
            message: "Ingresa un correo electrónico válido.",
        }),

    password: z
        .string({
            message: "Ingresa una contraseña.",
        })
        .min(6, {
            message: "La contraseña debe tener al menos 6 caracteres.",
        })
    ,
    username: z
        .string({
            message: "Ingresa un nombre de usuario.",
        })
        .min(3, {
            message: "Mínimo 3 caracteres.",
        }),

    rol: z.enum(["user", "admin", "manager"], {
        message: "Selecciona un rol válido.",
    }).optional().default("user"),

    celular_codigo: z.string().optional().default("+57"),

    celular_numero: z.string().optional(),
})

export const createCustomerAction = async (formData: any) => {
    const getVal = (key1: string, key2?: string) => {
        if (!formData) return undefined
        if (formData instanceof FormData) {
            return (formData.get(key1) || (key2 ? formData.get(key2) : undefined) || undefined) as string | undefined
        }
        return formData[key1] ?? (key2 ? formData[key2] : undefined) ?? undefined
    }

    const raw = {
        email: getVal('Correo', 'email'),
        password: getVal('password', 'Contraseña') || "123456",
        username: getVal('Nombre', 'username') || getVal('name'),
        rol: getVal('rol', 'Rol') || "user",
        celular_codigo: getVal('celular_codigo') || "+57",
        celular_numero: getVal('Teléfono', 'celular_numero') || getVal('phone') || "",
    }

    const data = schema.safeParse(raw)

    if (!data.success) {
        const fieldErrors = z.flattenError(data.error).fieldErrors
        const firstError = Object.values(fieldErrors).flat()[0]
        return firstError || "Datos de cliente no válidos."
    }

    if (data.data.celular_numero) {
        const { getCountryByCode } = await import("@lib/countries")
        const country = getCountryByCode(data.data.celular_codigo || "+57")
        if (country) {
            const digits = data.data.celular_numero.replace(/\D/g, "")
            if (digits.length > 0 && (digits.length < country.minDigits || digits.length > country.maxDigits)) {
                return `El número debe tener entre ${country.minDigits} y ${country.maxDigits} dígitos para ${country.country}.`
            }
        }
    }

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()

    const metadata: Record<string, string> = {
        username: data.data.username,
        role: data.data.rol || "user",
    }
    if (data.data.celular_numero) {
        metadata.phone = `${data.data.celular_codigo || "+57"} ${data.data.celular_numero}`
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
