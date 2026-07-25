"use server";

import { z } from "zod";
import { createClient } from "@/app/lib/supabase/server";
import { cookies } from "next/headers";

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
        })
        .max(20, {
            message: "La contraseña no puede superar los 20 caracteres.",
        })
        .regex(/(?=.*[a-z])/, {
            message: "Incluye al menos una letra minúscula.",
        })
        .regex(/(?=.*[A-Z])/, {
            message: "Incluye al menos una letra mayúscula.",
        })
        .regex(/(?=.*[@$!%*?&])/, {
            message: "Incluye al menos un carácter especial (@$!%*?&).",
        }),
    remember: z.boolean().optional(),
})

export type LoginState = {
    success: boolean
    errors?: Record<string, string[] | undefined>
    message?: string
}

export const loginAction = async (initialState: LoginState, formData: FormData) => {
    const data = schema.safeParse({
        email: formData.get('email'),
        password: formData.get('contraseña'),
        remember: formData.get('recordar') ?? false,
    })

    if (!data.success) {
        return {
            success: false,
            errors: z.flattenError(data.error).fieldErrors,
        } satisfies LoginState
    }

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const { error } = await supabase.auth.signInWithPassword({
        email: data.data.email,
        password: data.data.password,
    })

    if (error) {
        return {
            success: false,
            errors: {},
            message: error.message,
        } satisfies LoginState
    }

    return {
        success: true,
        errors: {},
    } satisfies LoginState
}
