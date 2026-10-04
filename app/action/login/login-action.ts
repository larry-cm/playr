"use server"

import { z } from "zod"
import { createSupabaseTab } from "@lib/supabase/server"
import { esSid, rutaTab } from "@lib/sesion-tab"
import { notificar } from "@lib/notify"
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
    // El sid lo genera la pestaña (sessionStorage): la sesión queda solo para ella.
    const sid = formData.get("sid")
    if (!esSid(sid)) {
        return {
            success: false,
            errors: {},
            message: "Recarga la página e intenta de nuevo.",
        } satisfies LoginState
    }

    const supabase = await createSupabaseTab(sid)
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

    // Una cuenta, un solo lugar: se cierran sus demás sesiones (otras pestañas u
    // otros navegadores), que vuelven al login en su siguiente petición.
    // Si falla, el login sigue (no se bloquea al usuario) pero queda el aviso para el staff.
    const { error: cierreError } = await supabase.auth.signOut({ scope: "others" })
    if (cierreError) {
        console.error("login: no se cerraron las otras sesiones:", cierreError.message)
        await notificar({
            origen: "plataforma",
            tipo: "advertencia",
            titulo: "No se cerraron las otras sesiones",
            mensaje: `${data.data.email} inició sesión, pero sus otras sesiones siguen abiertas: ${cierreError.message}`,
        })
    }

    redirect(rutaTab(sid, "/administrar"))
}
