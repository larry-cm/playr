"use server";

import { z } from "zod";
import { createClient } from "@/app/lib/supabase/server";
import { cookies, headers } from "next/headers";
import { translateAuthError } from "@lib/supabase/auth-errors";

const schema = z.object({
    email: z
        .string({
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

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (await headers()).get('origin') || 'http://localhost:3000'
    const redirectTo = `${siteUrl}/reestablecer`

    const { error } = await supabase.auth.resetPasswordForEmail(data.data.email, {
        redirectTo,
    })

    if (error) {
        const isRateLimited = error.status === 429
        return {
            success: false,
            errors: {},
            message: isRateLimited
                ? "Has alcanzado el límite de solicitudes. El sistema permite hasta 2 correos por hora. Intenta de nuevo más tarde."
                : translateAuthError(error.message),
        } satisfies ForgotPasswordState
    }

    return {
        success: true,
        errors: {},
        message: "Revisa tu correo electrónico. Si la cuenta existe, recibirás un enlace para restablecer tu contraseña.",
    } satisfies ForgotPasswordState
}
