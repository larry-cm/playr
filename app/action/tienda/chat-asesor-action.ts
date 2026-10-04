"use server"

import { after } from "next/server"
import { reenviarMensajeAsesor } from "@lib/telegram"
import { firmarAdjuntos } from "@lib/chat-firmar"
import type { TipoAdjunto } from "@lib/chat-adjunto"

export interface MensajeChat {
    id: number
    autor: "cliente" | "asesor"
    texto: string
    pedido_id: number | null
    leido: boolean
    created_at: string
    adjunto_tipo: TipoAdjunto | null
    /** Enlace temporal a la imagen o nota de voz (null = sin adjunto o no se pudo abrir). */
    adjunto_url: string | null
}

/** Archivo ya subido al bucket 'chat' (carpeta del cliente) que va con el mensaje. */
export interface AdjuntoSubido {
    path: string
    tipo: TipoAdjunto
}

export type ChatResult = { ok: true; mensajes: MensajeChat[] } | { ok: false; error: string }

const SIN_SESION = "Tu sesión expiró. Vuelve a iniciar sesión."

/** Conversación del cliente que llama con el asesor (últimos 200 mensajes, más viejos primero). La RLS solo deja ver los propios. */
export async function getMensajesAction(): Promise<ChatResult> {
    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: SIN_SESION }

    const { data, error } = await supabase
        .schema("business")
        .from("mensaje_asesor")
        .select("id,autor,texto,pedido_id,leido,created_at,adjunto_path,adjunto_tipo")
        .eq("cliente_id", user.id)
        .order("id", { ascending: false })
        .limit(200)
    if (error) {
        console.error("getMensajesAction:", error.message)
        return { ok: false, error: "No se pudo cargar la conversación." }
    }
    return { ok: true, mensajes: (await firmarAdjuntos(supabase, data)).reverse() }
}

/** Respuestas del asesor que el cliente aún no vio (para el aviso en Mis compras). */
export async function getNoLeidosAction(): Promise<number> {
    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 0
    const { count } = await supabase
        .schema("business")
        .from("mensaje_asesor")
        .select("id", { count: "exact", head: true })
        .eq("cliente_id", user.id)
        .eq("autor", "asesor")
        .eq("leido", false)
    return count ?? 0
}

export async function marcarLeidosAction(): Promise<void> {
    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    const { error } = await supabase.schema("business").rpc("marcar_mensajes_leidos")
    if (error) console.error("marcarLeidosAction:", error.message)
}

/**
 * Guarda el mensaje del cliente (business.enviar_mensaje_asesor valida dueño del pedido, adjunto, largo y límite) y, después de
 * responder, lo lleva al Telegram del asesor.
 */
export async function enviarMensajeAction(
    texto: string,
    pedidoId: number | null,
    adjunto: AdjuntoSubido | null = null,
): Promise<{ ok: true } | { ok: false; error: string }> {
    if (typeof texto !== "string" || (!texto.trim() && !adjunto)) return { ok: false, error: "Escribe un mensaje." }
    if (adjunto && (typeof adjunto.path !== "string" || (adjunto.tipo !== "imagen" && adjunto.tipo !== "audio"))) return { ok: false, error: "El archivo adjunto no es válido." }
    if (pedidoId !== null && !Number.isInteger(pedidoId)) return { ok: false, error: "Pedido no encontrado." }

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    const { data, error } = await supabase
        .schema("business")
        .rpc("enviar_mensaje_asesor", { p_texto: texto, p_pedido_id: pedidoId, p_adjunto_path: adjunto?.path ?? null, p_adjunto_tipo: adjunto?.tipo ?? null })
    if (error || typeof data !== "number") {
        console.error("enviarMensajeAction:", error?.message)
        if (error?.code === "42501") return { ok: false, error: SIN_SESION }
        return { ok: false, error: error && (error.code === "P0001" || error.code === "22023") ? error.message : "No se pudo enviar el mensaje. Inténtalo de nuevo." }
    }

    const mensajeId = data
    after(() => reenviarMensajeAsesor(mensajeId))
    return { ok: true }
}
