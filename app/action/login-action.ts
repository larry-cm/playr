"use server";

import { z } from "zod";
import { createSupabase } from "@/app/lib/supabase/server";
import { redirect } from "next/navigation";
import { translateAuthError } from "@lib/supabase/auth-errors";

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
    const supabase = await createSupabase()
    const { error } = await supabase.auth.signInWithPassword({
        email: data.data.email,
        password: data.data.password,
    })

    if (error) {
        return {
            success: false,
            errors: {},
            message: translateAuthError(error.message),
        } satisfies LoginState
    }

    redirect("/administrar")
}
