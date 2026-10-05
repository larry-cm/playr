"use server"

import { after } from "next/server"
import { esStaff, SIN_PERMISO } from "@lib/auth"
import { copiarMensajePanelTelegram } from "@lib/telegram"
import type { EstadoPedido } from "@lib/pedido"
import { firmarAdjuntos } from "@lib/chat-firmar"
import { resumenMensaje, type TipoAdjunto } from "@lib/chat-adjunto"
import {
    cargarInteracciones,
    clienteIdSchema,
    firstError,
    respondeASchema,
    type AutorChat,
    type ColorEtiqueta,
    type InteraccionesMensaje,
    type MensajeFijado,
} from "@lib/chat-bandeja"
import { errorDeRpc } from "@action/manager-and-admin/mensajes/rpc-staff"
import type { AdjuntoSubido } from "@action/tienda/chat-asesor-action"

export interface ClienteChat {
    username: string | null
    email: string | null
    phone: string | null
}

export interface Conversacion {
    cliente_id: string
    cliente: ClienteChat | null
    /** Último mensaje visible para el staff (texto = resumen, con 📷/🎤 si tiene adjunto). */
    ultimo: { id: number; texto: string; autor: AutorChat; created_at: string }
    /** Mensajes visibles del cliente que el staff aún no abrió. */
    sinLeer: number
    fijadoEn: string | null
    archivadoEn: string | null
    /** Marcado "no leído" a mano (cuenta 1 en la insignia si no hay mensajes sin leer). */
    noLeidoManual: boolean
    /** Ids de etiquetas y carpetas, ordenados. */
    etiquetas: number[]
    carpetas: number[]
}

export interface Etiqueta {
    id: number
    nombre: string
    color: ColorEtiqueta
}

export interface Carpeta {
    id: number
    nombre: string
    icono: string | null
    orden: number
    /** Chats en la carpeta (≤100). */
    chats: number
}

/** Bandeja del staff: chats (el más reciente primero; fijados y archivados se ordenan/filtran en la UI), etiquetas y carpetas. */
export interface Bandeja {
    conversaciones: Conversacion[]
    /** Por nombre. */
    etiquetas: Etiqueta[]
    /** Por orden. */
    carpetas: Carpeta[]
}

export interface MensajeStaff extends InteraccionesMensaje {
    id: number
    autor: AutorChat
    texto: string
    pedido_id: number | null
    autor_via: string | null
    created_at: string
    adjunto_tipo: TipoAdjunto | null
    adjunto_url: string | null
}

export interface PedidoResumen {
    id: number
    estado: EstadoPedido
    total: number
    created_at: string
    items: { platform_nombre: string; perfil_nombre: string; access_type: string }[]
}

/** Estado del chat para el panel de detalles. */
export interface EstadoChat {
    fijadoEn: string | null
    archivadoEn: string | null
    noLeidoManual: boolean
    notas: string | null
    etiquetas: number[]
    carpetas: number[]
}

export type DetalleConversacion =
    | {
          ok: true
          cliente: ClienteChat | null
          /** Alta del cliente (security.client.created_at). */
          clienteDesde: string | null
          estado: EstadoChat
          /** Más viejos primero; solo los visibles para el staff (después de un "eliminar chat"). */
          mensajes: MensajeStaff[]
          /** Mensajes fijados del chat (≤3), el más reciente primero; pueden estar fuera de los 300 cargados. */
          fijados: MensajeFijado[]
          pedidos: PedidoResumen[]
      }
    | { ok: false; error: string }

const ids = (xs: unknown): number[] => (Array.isArray(xs) ? xs.map(Number) : [])

/** Bandeja del staff (business.chat_bandeja_staff + etiquetas y carpetas). null = error o sin permiso. */
export async function getConversacionesAction(): Promise<Bandeja | null> {
    if (!(await esStaff())) return null
    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    const db = supabase.schema("business")

    const [bandeja, etiquetas, carpetas, miembros] = await Promise.all([
        db.rpc("chat_bandeja_staff"),
        db.from("chat_etiqueta").select("id,nombre,color").order("nombre"),
        db.from("chat_carpeta").select("id,nombre,icono,orden").order("orden"),
        db.from("chat_carpeta_cliente").select("carpeta_id").limit(2000),
    ])
    const error = bandeja.error ?? etiquetas.error ?? carpetas.error ?? miembros.error
    if (error) {
        console.error("getConversacionesAction:", error.message)
        return null
    }

    const porCarpeta = new Map<number, number>()
    for (const m of miembros.data ?? []) porCarpeta.set(Number(m.carpeta_id), (porCarpeta.get(Number(m.carpeta_id)) ?? 0) + 1)

    return {
        conversaciones: (bandeja.data as Record<string, unknown>[]).map((r) => ({
            cliente_id: String(r.cliente_id),
            cliente: { username: (r.username as string | null) ?? null, email: (r.email as string | null) ?? null, phone: (r.phone as string | null) ?? null },
            ultimo: {
                id: Number(r.ultimo_id),
                texto: resumenMensaje({ texto: (r.ultimo_texto as string) ?? "", adjunto_tipo: (r.ultimo_adjunto_tipo as TipoAdjunto | null) ?? null }),
                autor: r.ultimo_autor as AutorChat,
                created_at: String(r.ultimo_created_at),
            },
            sinLeer: Number(r.sin_leer) || 0,
            fijadoEn: (r.fijado_en as string | null) ?? null,
            archivadoEn: (r.archivado_en as string | null) ?? null,
            noLeidoManual: r.no_leido_manual === true,
            etiquetas: ids(r.etiquetas),
            carpetas: ids(r.carpetas),
        })),
        etiquetas: (etiquetas.data ?? []).map((e) => ({ id: Number(e.id), nombre: e.nombre, color: e.color })),
        carpetas: (carpetas.data ?? []).map((c) => ({ id: Number(c.id), nombre: c.nombre, icono: c.icono, orden: c.orden, chats: porCarpeta.get(Number(c.id)) ?? 0 })),
    }
}

/** Conversación con un cliente (solo lo visible para el staff), su estado y sus últimos pedidos; marca como leídos sus mensajes. */
export async function getConversacionAction(clienteId: string): Promise<DetalleConversacion> {
    if (!(await esStaff())) return { ok: false, error: SIN_PERMISO }
    const c = clienteIdSchema.safeParse(clienteId)
    if (!c.success) return { ok: false, error: firstError(c.error) }
    const id = c.data
    const { getUsuario } = await import("@lib/supabase/server")
    const { user, supabase } = await getUsuario()
    const db = supabase.schema("business")

    const [estado, etiquetas, carpetas, pedidos, cliente] = await Promise.all([
        db.from("chat_estado").select("fijado_en,archivado_en,eliminado_hasta,no_leido_manual,notas").eq("cliente_id", id).maybeSingle(),
        db.from("chat_cliente_etiqueta").select("etiqueta_id").eq("cliente_id", id).order("etiqueta_id"),
        db.from("chat_carpeta_cliente").select("carpeta_id").eq("cliente_id", id).order("carpeta_id"),
        db.from("pedido").select("id,estado,total,created_at,pedido_item(platform_nombre,perfil_nombre,access_type)").eq("cliente_id", id).order("created_at", { ascending: false }).limit(10),
        supabase.schema("security").from("client").select("username,email,phone,created_at").eq("id", id).maybeSingle(),
    ])
    const errLectura = estado.error ?? etiquetas.error ?? carpetas.error ?? pedidos.error
    if (errLectura) {
        console.error("getConversacionAction:", errLectura.message)
        return { ok: false, error: "No se pudo cargar la conversación." }
    }

    // RLS no oculta al staff lo eliminado: el filtro va acá.
    const visibleDesde = Number(estado.data?.eliminado_hasta ?? 0)
    const mensajes = await db
        .from("mensaje_asesor")
        .select("id,autor,texto,pedido_id,autor_via,created_at,adjunto_path,adjunto_tipo,responde_a,fijado_en")
        .eq("cliente_id", id)
        .gt("id", visibleDesde)
        .order("id", { ascending: false })
        .limit(300)
    if (mensajes.error) {
        console.error("getConversacionAction:", mensajes.error.message)
        return { ok: false, error: "No se pudo cargar la conversación." }
    }

    const { error: errLeidos } = await db.rpc("marcar_leidos_staff", { p_cliente_id: id })
    if (errLeidos) console.error("getConversacionAction: marcar leídos", errLeidos.message)

    const firmados = (await firmarAdjuntos(supabase, mensajes.data)).reverse()
    const { mensajes: conInteracciones, fijados } = await cargarInteracciones(supabase, id, firmados, { userId: user?.id ?? null, visibleDesde })
    const { username = null, email = null, phone = null, created_at = null } = cliente.data ?? {}

    return {
        ok: true,
        cliente: cliente.data ? { username, email, phone } : null,
        clienteDesde: created_at,
        estado: {
            fijadoEn: estado.data?.fijado_en ?? null,
            archivadoEn: estado.data?.archivado_en ?? null,
            // Abrir el chat (marcar_leidos_staff) quita la marca.
            noLeidoManual: errLeidos ? estado.data?.no_leido_manual === true : false,
            notas: estado.data?.notas ?? null,
            etiquetas: (etiquetas.data ?? []).map((e) => Number(e.etiqueta_id)),
            carpetas: (carpetas.data ?? []).map((e) => Number(e.carpeta_id)),
        },
        mensajes: conInteracciones.map((m) => ({ ...m, id: Number(m.id), pedido_id: m.pedido_id === null ? null : Number(m.pedido_id) })),
        fijados,
        pedidos: (pedidos.data ?? []).map(({ pedido_item, ...p }) => ({ ...p, total: Number(p.total), items: pedido_item ?? [] })),
    }
}

/** Respuesta del staff desde el panel (respondeA = mensaje citado); después de responder se copia al tema del cliente en Telegram. */
export async function enviarMensajeStaffAction(
    clienteId: string,
    texto: string,
    adjunto: AdjuntoSubido | null = null,
    respondeA: number | null = null,
): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!(await esStaff())) return { ok: false, error: SIN_PERMISO }
    const c = clienteIdSchema.safeParse(clienteId)
    if (!c.success) return { ok: false, error: firstError(c.error) }
    if (typeof texto !== "string" || (!texto.trim() && !adjunto)) return { ok: false, error: "Escribe un mensaje." }
    if (adjunto && (typeof adjunto.path !== "string" || (adjunto.tipo !== "imagen" && adjunto.tipo !== "audio"))) return { ok: false, error: "El archivo adjunto no es válido." }
    const r = respondeASchema.safeParse(respondeA ?? null)
    if (!r.success) return { ok: false, error: firstError(r.error) }

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.schema("business").rpc("enviar_mensaje_staff", {
        p_cliente_id: c.data,
        p_texto: texto,
        p_via: `panel:${user?.email ?? "staff"}`,
        p_adjunto_path: adjunto?.path ?? null,
        p_adjunto_tipo: adjunto?.tipo ?? null,
        p_responde_a: r.data,
    })
    if (error || typeof data !== "number") {
        console.error("enviarMensajeStaffAction:", error?.message)
        return { ok: false, error: error ? errorDeRpc(error, "No se pudo enviar el mensaje. Inténtalo de nuevo.") : "No se pudo enviar el mensaje. Inténtalo de nuevo." }
    }

    const mensajeId = data
    after(() => copiarMensajePanelTelegram(mensajeId))
    return { ok: true }
}
