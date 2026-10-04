"use server"

import { after } from "next/server"
import { esStaff, SIN_PERMISO } from "@lib/auth"
import { copiarMensajePanelTelegram } from "@lib/telegram"
import type { EstadoPedido } from "@lib/pedido"
import { firmarAdjuntos } from "@lib/chat-firmar"
import { resumenMensaje, type TipoAdjunto } from "@lib/chat-adjunto"
import type { AdjuntoSubido } from "@action/tienda/chat-asesor-action"

export interface ClienteChat {
    username: string | null
    email: string | null
    phone: string | null
}

export interface Conversacion {
    cliente_id: string
    cliente: ClienteChat | null
    ultimo: { texto: string; autor: "cliente" | "asesor"; created_at: string }
    /** Mensajes del cliente que el staff aún no abrió. */
    sinLeer: number
}

export interface MensajeStaff {
    id: number
    autor: "cliente" | "asesor"
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

export type DetalleConversacion = { ok: true; cliente: ClienteChat | null; mensajes: MensajeStaff[]; pedidos: PedidoResumen[] } | { ok: false; error: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Un chat por cliente, el de actividad más reciente primero (sale de los últimos 2000 mensajes). null = error o sin permiso. */
export async function getConversacionesAction(): Promise<Conversacion[] | null> {
    if (!(await esStaff())) return null
    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()

    const { data, error } = await supabase
        .schema("business")
        .from("mensaje_asesor")
        .select("cliente_id,autor,texto,leido,created_at,adjunto_tipo")
        .order("id", { ascending: false })
        .limit(2000)
    if (error) {
        console.error("getConversacionesAction:", error.message)
        return null
    }

    const porCliente = new Map<string, Conversacion>()
    for (const m of data) {
        const c = porCliente.get(m.cliente_id)
        const sinLeer = m.autor === "cliente" && !m.leido ? 1 : 0
        if (c) c.sinLeer += sinLeer
        else porCliente.set(m.cliente_id, { cliente_id: m.cliente_id, cliente: null, ultimo: { texto: resumenMensaje(m), autor: m.autor, created_at: m.created_at }, sinLeer })
    }

    const ids = [...porCliente.keys()]
    if (ids.length) {
        const { data: clientes } = await supabase.schema("security").from("client").select("id,username,email,phone").in("id", ids)
        for (const c of clientes ?? []) {
            const conv = porCliente.get(c.id)
            if (conv) conv.cliente = { username: c.username, email: c.email, phone: c.phone }
        }
    }
    return [...porCliente.values()]
}

/** Conversación con un cliente y sus últimos pedidos; marca como leídos sus mensajes. */
export async function getConversacionAction(clienteId: string): Promise<DetalleConversacion> {
    if (!(await esStaff())) return { ok: false, error: SIN_PERMISO }
    if (typeof clienteId !== "string" || !UUID.test(clienteId)) return { ok: false, error: "Cliente no encontrado." }
    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    const db = supabase.schema("business")

    const [mensajes, pedidos, cliente] = await Promise.all([
        db.from("mensaje_asesor").select("id,autor,texto,pedido_id,autor_via,created_at,adjunto_path,adjunto_tipo").eq("cliente_id", clienteId).order("id", { ascending: false }).limit(300),
        db.from("pedido").select("id,estado,total,created_at,pedido_item(platform_nombre,perfil_nombre,access_type)").eq("cliente_id", clienteId).order("created_at", { ascending: false }).limit(10),
        supabase.schema("security").from("client").select("username,email,phone").eq("id", clienteId).maybeSingle(),
    ])
    if (mensajes.error || pedidos.error) {
        console.error("getConversacionAction:", mensajes.error?.message ?? pedidos.error?.message)
        return { ok: false, error: "No se pudo cargar la conversación." }
    }

    const { error: errLeidos } = await db.rpc("marcar_leidos_staff", { p_cliente_id: clienteId })
    if (errLeidos) console.error("getConversacionAction: marcar leídos", errLeidos.message)

    return {
        ok: true,
        cliente: cliente.data ?? null,
        mensajes: (await firmarAdjuntos(supabase, mensajes.data)).reverse(),
        pedidos: pedidos.data.map(({ pedido_item, ...p }) => ({ ...p, total: Number(p.total), items: pedido_item ?? [] })),
    }
}

/** Respuesta del staff desde el panel; después de responder se copia al tema del cliente en Telegram. */
export async function enviarMensajeStaffAction(
    clienteId: string,
    texto: string,
    adjunto: AdjuntoSubido | null = null,
): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!(await esStaff())) return { ok: false, error: SIN_PERMISO }
    if (typeof clienteId !== "string" || !UUID.test(clienteId)) return { ok: false, error: "Cliente no encontrado." }
    if (typeof texto !== "string" || (!texto.trim() && !adjunto)) return { ok: false, error: "Escribe un mensaje." }
    if (adjunto && (typeof adjunto.path !== "string" || (adjunto.tipo !== "imagen" && adjunto.tipo !== "audio"))) return { ok: false, error: "El archivo adjunto no es válido." }

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
        .schema("business")
        .rpc("enviar_mensaje_staff", { p_cliente_id: clienteId, p_texto: texto, p_via: `panel:${user?.email ?? "staff"}`, p_adjunto_path: adjunto?.path ?? null, p_adjunto_tipo: adjunto?.tipo ?? null })
    if (error || typeof data !== "number") {
        console.error("enviarMensajeStaffAction:", error?.message)
        return { ok: false, error: error?.code === "22023" ? error.message : "No se pudo enviar el mensaje. Inténtalo de nuevo." }
    }

    const mensajeId = data
    after(() => copiarMensajePanelTelegram(mensajeId))
    return { ok: true }
}
