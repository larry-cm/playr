"use server"

import { z } from "zod"
import { createSupabase } from "@lib/supabase/server"
import { redirect } from "next/navigation"
import { translateAuthError } from "@lib/supabase/auth-errors"

// Al iniciar sesión solo se exige que haya datos: las reglas de complejidad son
// para crear o cambiar la contraseña, no para comprobar una que ya existe.
const schema = z.object({
    email: z
        .string({
            message: "Ingresa un correo electrónico.",
        })
        .trim()
        .min(1, {
            message: "Ingresa un correo electrónico.",
        })
        .email({
            message: "Ingresa un correo electrónico válido.",
        }),

    password: z
        .string({
            message: "Ingresa una contraseña.",
        })
        .min(1, {
            message: "Ingresa una contraseña.",
        }),
})

export type LoginState = {
    success: boolean
    errors?: Record<string, string[] | undefined>
    message?: string
}

export const loginAction = async (initialState: LoginState, formData: FormData) => {
    const data = schema.safeParse({
        email: formData.get('email'),
        password: formData.get('password'),
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
