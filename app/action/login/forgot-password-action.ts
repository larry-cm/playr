"use server"

import { z } from "zod"
import { createSupabase } from "@lib/supabase/server"
import { translateAuthError } from "@lib/supabase/auth-errors"
import { DEMASIADOS_INTENTOS, intentar } from "@lib/limite-auth"

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
})

export type ForgotPasswordState = {
    success: boolean
    errors?: Record<string, string[] | undefined>
    message?: string
}

// El enlace del correo apunta a una URL fija. Nunca se arma con el header
// Origin: lo controla quien hace la petición y permitiría mandar el enlace
// (con el código de recuperación) a un dominio ajeno.
function getSiteUrl(): string | null {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    if (siteUrl) return siteUrl.replace(/\/+$/, "")
    if (process.env.NODE_ENV !== "production") return "http://localhost:3000"
    return null
}

export const forgotPasswordAction = async (initialState: ForgotPasswordState, formData: FormData) => {
    const data = schema.safeParse({
        email: formData.get('email'),
    })

    if (!data.success) {
        return {
            success: false,
            errors: z.flattenError(data.error).fieldErrors,
        } satisfies ForgotPasswordState
    }

    const siteUrl = getSiteUrl()
    if (!siteUrl) {
        console.error("forgotPasswordAction: falta NEXT_PUBLIC_SITE_URL en producción")
        return {
            success: false,
            errors: {},
            message: "No se pudo enviar el enlace. Intenta más tarde.",
        } satisfies ForgotPasswordState
    }

    if ((await intentar("recuperar", data.data.email)).bloqueado) {
        return { success: false, errors: {}, message: DEMASIADOS_INTENTOS } satisfies ForgotPasswordState
    }

    const supabase = await createSupabase()
    const { error } = await supabase.auth.resetPasswordForEmail(data.data.email, {
        redirectTo: `${siteUrl}/reestablecer`,
    })

    if (error) {
        const isRateLimited = error.status === 429
        return {
            success: false,
            errors: {},
            message: isRateLimited
                ? "Demasiados intentos. Intenta más tarde."
                : translateAuthError(error.message),
        } satisfies ForgotPasswordState
    }

    return {
        success: true,
        errors: {},
        message: "Revisa tu correo electrónico. Si la cuenta existe, recibirás un enlace para restablecer tu contraseña.",
    } satisfies ForgotPasswordState
}
