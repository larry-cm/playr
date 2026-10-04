import { headers } from "next/headers"
import { createSupabaseAdmin } from "@lib/supabase/admin"
import { notificar } from "@lib/notify"

// Límite propio de intentos de login y recuperación (security.auth_intento, ver su migración): Supabase Auth solo ve
// la IP del servidor. Si la base no responde no se bloquea a nadie (se registra el error): el límite es una defensa
// extra, Auth sigue validando la contraseña.

type Tipo = "login" | "recuperar"

export const DEMASIADOS_INTENTOS = "Demasiados intentos. Espera unos minutos e inténtalo de nuevo."

/** bloqueado = no llamar a Auth. intentoId = el intento anotado (para descartarlo si Auth falla por su cuenta). */
export type Intento = { bloqueado: true } | { bloqueado: false; intentoId: number | null }

async function ipCliente(): Promise<string> {
    const h = await headers()
    // En Vercel x-forwarded-for lo pone el propio Vercel (no se puede falsificar desde el cliente).
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconocida"
}

/** Anota el intento antes de llamar a Auth (atómico en la base: una ráfaga en paralelo no pasa el tope). */
export async function intentar(tipo: Tipo, email: string): Promise<Intento> {
    const admin = createSupabaseAdmin()
    if (!admin) return { bloqueado: false, intentoId: null }
    const { data, error } = await admin
        .schema("security")
        .rpc("auth_intentar", { p_tipo: tipo, p_ip: await ipCliente(), p_email: email })
        .single<{ intento_id: number | null; motivo: string | null }>()
    if (error || !data) {
        console.error("intentar:", error?.message)
        return { bloqueado: false, intentoId: null }
    }
    if (data.motivo === "correo") {
        // Muchos intentos contra un mismo correo desde muchas IPs: ataque dirigido a esa cuenta.
        await notificar({
            origen: "plataforma",
            tipo: "advertencia",
            titulo: "Cuenta bajo ataque de contraseñas",
            mensaje: `Demasiados intentos de ${tipo === "login" ? "inicio de sesión" : "recuperación"} para ${email} desde varias IPs: queda bloqueado por un rato.`,
        })
    }
    return data.intento_id === null ? { bloqueado: true } : { bloqueado: false, intentoId: data.intento_id }
}

/** Auth falló por su cuenta (429/5xx): el intento no cuenta contra el usuario. */
export async function descartarIntento(intento: Intento): Promise<void> {
    if (intento.bloqueado || intento.intentoId === null) return
    const admin = createSupabaseAdmin()
    if (!admin) return
    const { error } = await admin.schema("security").rpc("auth_descartar", { p_intento_id: intento.intentoId })
    if (error) console.error("descartarIntento:", error.message)
}

export async function limpiarIntentos(email: string): Promise<void> {
    const admin = createSupabaseAdmin()
    if (!admin) return
    const { error } = await admin.schema("security").rpc("auth_limpiar", { p_email: email })
    if (error) console.error("limpiarIntentos:", error.message)
}
