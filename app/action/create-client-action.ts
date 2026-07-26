"use server";

import { z } from "zod";
import { createSupabase } from "@/app/lib/supabase/server";
import { getCountryByCode } from "@lib/countries";

const schema = z.object({
    email: z
        .string({
            message: "Ingresa un correo electrónico.",
        })
        .email({
            message: "Ingresa un correo electrónico válido.",
        }),

    password: z
        .string({
            message: "Ingresa una contraseña.",
        })
        .min(6, {
            message: "La contraseña debe tener al menos 6 caracteres.",
        }),

    username: z
        .string({
            message: "Ingresa un nombre de usuario.",
        })
        .min(3, {
            message: "Mínimo 3 caracteres.",
        })
        .max(10, {
            message: "Máximo 10 caracteres.",
        })
        .regex(/^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+$/, {
            message: "Solo letras, sin espacios ni números.",
        }),

    rol: z.enum(["user", "admin", "manager"], {
        message: "Selecciona un rol válido.",
    }),

    celular_codigo: z.string().optional(),

    celular_numero: z.string().optional(),
})

export type CreateClientState = {
    success: boolean
    errors?: Record<string, string[] | undefined>
    message?: string
}

export const createClientAction = async (initialState: CreateClientState, formData: FormData) => {
    const raw = {
        email: formData.get('email'),
        password: formData.get('password'),
        username: formData.get('username'),
        rol: formData.get('rol'),
        celular_codigo: formData.get('celular_codigo') || "+52",
        celular_numero: formData.get('celular_numero') || "",
    }

    const data = schema.safeParse(raw)

    if (!data.success) {
        return {
            success: false,
            errors: z.flattenError(data.error).fieldErrors,
        } satisfies CreateClientState
    }

    if (data.data.celular_numero) {
        const country = getCountryByCode(data.data.celular_codigo!)
        if (!country) {
            return {
                success: false,
                errors: { celular_codigo: ["Código de país no válido."] },
            } satisfies CreateClientState
        }
        const digits = data.data.celular_numero.replace(/\D/g, "")
        if (digits.length < country.minDigits || digits.length > country.maxDigits) {
            return {
                success: false,
                errors: {
                    celular_numero: [`El número debe tener entre ${country.minDigits} y ${country.maxDigits} dígitos para ${country.country}.`],
                },
            } satisfies CreateClientState
        }
    }

    const supabase = await createSupabase()

    const metadata: Record<string, string> = {
        username: data.data.username,
        role: data.data.rol,
    }
    if (data.data.celular_numero) {
        metadata.phone = `${data.data.celular_codigo} ${data.data.celular_numero}`
    }

    const { error } = await supabase.auth.signUp({
        email: data.data.email,
        password: data.data.password,
        options: { data: metadata },
    })

    if (error) {
        return {
            success: false,
            errors: {},
            message: error.message,
        } satisfies CreateClientState
    }

    return {
        success: true,
        errors: {},
        message: "Cliente creado exitosamente.",
    } satisfies CreateClientState
}
