"use server"

// Reaccionar y fijar mensajes del chat con el asesor. Lo usan el staff (bandeja) y el cliente (su propio chat): la
// función de la base decide quién puede (staff con el mensaje visible, o el dueño del chat).
import { SIN_PERMISO } from "@lib/auth"
import { booleanoSchema, firstError, mensajeIdSchema, reaccionSchema, SIN_SESION, type Reaccion } from "@lib/chat-bandeja"

type Resultado<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string }

function errorDe(error: { code?: string; message: string }): string {
    if (error.code === "22023") return error.message
    if (error.code === "42501") return error.message === "sin sesión" ? SIN_SESION : SIN_PERMISO
    return "No se pudo guardar el cambio. Inténtalo de nuevo."
}

async function sesion() {
    const { getUsuario } = await import("@lib/supabase/server")
    return getUsuario()
}

/** Pone, cambia o quita (null, o la misma otra vez) la reacción de quien llama. Devuelve la que quedó (null = ninguna). */
export async function reaccionarMensajeAction(mensajeId: number, emoji: string | null): Promise<Resultado<{ emoji: Reaccion | null }>> {
    const m = mensajeIdSchema.safeParse(mensajeId)
    if (!m.success) return { ok: false, error: firstError(m.error) }
    const e = reaccionSchema.safeParse(emoji)
    if (!e.success) return { ok: false, error: firstError(e.error) }

    const { user, supabase } = await sesion()
    if (!user) return { ok: false, error: SIN_SESION }
    const { data, error } = await supabase.schema("business").rpc("mensaje_reaccionar", { p_mensaje_id: m.data, p_emoji: e.data })
    if (error) {
        console.error("reaccionarMensajeAction:", error.code, error.message)
        return { ok: false, error: errorDe(error) }
    }
    return { ok: true, emoji: (data as Reaccion | null) ?? null }
}

/** Fija o desfija un mensaje del chat (≤3 por chat: fijar un 4.º desfija el más viejo). */
export async function fijarMensajeAction(mensajeId: number, fijar: boolean): Promise<Resultado> {
    const m = mensajeIdSchema.safeParse(mensajeId)
    if (!m.success) return { ok: false, error: firstError(m.error) }
    const f = booleanoSchema.safeParse(fijar)
    if (!f.success) return { ok: false, error: firstError(f.error) }

    const { user, supabase } = await sesion()
    if (!user) return { ok: false, error: SIN_SESION }
    const { error } = await supabase.schema("business").rpc("mensaje_fijar", { p_mensaje_id: m.data, p_fijar: f.data })
    if (error) {
        console.error("fijarMensajeAction:", error.code, error.message)
        return { ok: false, error: errorDe(error) }
    }
    return { ok: true }
}
