// Solo servidor. Bot de Telegram del asesor, sobre un grupo con Temas (TELEGRAM_CHAT_ID):
// - Cada cliente tiene su propio tema (business.telegram_tema). Ahí llegan los avisos de sus pedidos (comprobante,
//   datos y botones Aprobar/Rechazar) y sus mensajes del chat de Mis compras (texto, imágenes y notas de voz), con el
//   detalle del pedido del que habla.
// - Lo que el asesor escribe en el tema de un cliente le llega a ese cliente (app/api/telegram/route.ts). Lo que el staff
//   contesta desde la bandeja de Playr (/administrar/mensajes) se copia al tema, así la conversación está en los dos lados.
// Si el grupo no tiene Temas activados, todo va al grupo y el asesor contesta respondiendo el mensaje del cliente
// (business.telegram_hilo ata cada mensaje con su cliente). Sin TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID no hace nada: el
// pedido igual se revisa en /administrar/pedidos.
import type { SupabaseClient } from "@supabase/supabase-js"
import { createSupabaseAdmin } from "@lib/supabase/admin"
import { notificar } from "@lib/notify"
import { formatCOP } from "@lib/currency"
import { formatColombianDateTime } from "@lib/date"
import { comprobanteEsImagen, ESTADO_PEDIDO, type EstadoPedido } from "@lib/pedido"
import { resumenMensaje, type TipoAdjunto } from "@lib/chat-adjunto"
import { recortar } from "@lib/chat-bandeja"

const API = "https://api.telegram.org"

export interface TelegramCfg {
    token: string
    chatId: string
    /** Ids de usuario de Telegram de los asesores: aprueban/rechazan y le escriben a los clientes. */
    aprobadores: Set<string>
    /** Lo manda Telegram en X-Telegram-Bot-Api-Secret-Token (se fija al registrar el webhook). */
    webhookSecret: string
}

export function telegramCfg(): TelegramCfg | null {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
    const chatId = process.env.TELEGRAM_CHAT_ID?.trim()
    if (!token || !chatId) return null
    const aprobadores = new Set((process.env.TELEGRAM_APROBADORES ?? "").split(",").map((s) => s.trim()).filter(Boolean))
    return { token, chatId, aprobadores, webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? "" }
}

/** Llama a un método de la Bot API. Lanza con la descripción de Telegram si responde ok=false. */
export async function telegram<T = unknown>(cfg: TelegramCfg, metodo: string, body: Record<string, unknown> | FormData): Promise<T> {
    const res = await fetch(`${API}/bot${cfg.token}/${metodo}`, {
        method: "POST",
        ...(body instanceof FormData ? { body } : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(20_000),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null
    if (!json?.ok) throw new Error(`Telegram ${metodo}: ${json?.description ?? res.status}`)
    return json.result as T
}

/** Descarga un archivo que le mandaron al bot (la Bot API entrega hasta 20 MB). */
export async function descargarTelegram(cfg: TelegramCfg, fileId: string): Promise<ArrayBuffer> {
    const { file_path } = await telegram<{ file_path?: string }>(cfg, "getFile", { file_id: fileId })
    if (!file_path) throw new Error("Telegram no entregó el archivo")
    const res = await fetch(`${API}/file/bot${cfg.token}/${file_path}`, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) throw new Error(`Telegram: descarga ${res.status}`)
    return res.arrayBuffer()
}

/** Escapa texto para parse_mode HTML. */
export const html = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const TIPO: Record<string, string> = { completa: "Cuenta completa", pantalla: "Pantalla" }

/** URL pública de Playr, solo si es https (Telegram no acepta botones a http://localhost). */
const sitio = () => {
    const url = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "")
    return url?.startsWith("https://") ? url : null
}

type MensajeTg = { message_id: number; chat: { id: number } }
type Cliente = { username: string | null; email: string | null; phone: string | null }

interface PedidoTg {
    id: number
    cliente_id: string
    estado: EstadoPedido
    total: number
    llave_breb: string
    llave_nombre: string | null
    comprobante_path: string
    motivo_rechazo: string | null
    created_at: string
    pedido_item: { platform_nombre: string; perfil_nombre: string; access_type: string; precio: number }[] | null
}

const PEDIDO_COLUMNAS = "id,cliente_id,estado,total,llave_breb,llave_nombre,comprobante_path,motivo_rechazo,created_at,pedido_item(platform_nombre,perfil_nombre,access_type,precio)"

async function leerCliente(db: SupabaseClient, clienteId: string): Promise<Cliente | null> {
    const { data } = await db.schema("security").from("client").select("username,email,phone").eq("id", clienteId).maybeSingle()
    return data
}

const lineaCliente = (c: Cliente | null) =>
    `👤 ${html(c?.username ?? "Cliente")}${c?.email ? ` · ${html(c.email)}` : ""}${c?.phone ? ` · ${html(c.phone)}` : ""}`

/** Detalle de un pedido para que el asesor no tenga que ir a buscarlo. */
function detallePedido(p: PedidoTg): string[] {
    return [
        `🧾 <b>Pedido #${p.id}</b> · ${ESTADO_PEDIDO[p.estado].label} · ${html(formatColombianDateTime(p.created_at))}`,
        ...(p.pedido_item ?? []).map((i) => `• ${html(i.platform_nombre)} · ${html(TIPO[i.access_type] ?? i.access_type)} · ${html(i.perfil_nombre)} — ${html(formatCOP(Number(i.precio)))}`),
        `💰 Total: <b>${html(formatCOP(Number(p.total)))}</b> · 🔑 <code>${html(p.llave_breb)}</code>${p.llave_nombre ? ` (${html(p.llave_nombre)})` : ""}`,
        ...(p.estado === "rechazado" && p.motivo_rechazo ? [`❌ Motivo: ${html(p.motivo_rechazo)}`] : []),
    ]
}

/**
 * Anota de qué cliente es un mensaje de Telegram (para grupos sin Temas: el asesor responde ese mensaje) y, si copia un
 * mensaje de Playr, cuál (`mensajeId`): así las respuestas se citan en los dos sentidos.
 */
async function anotarHilo(db: SupabaseClient, m: MensajeTg, clienteId: string, pedidoId: number | null, mensajeId: number | null = null) {
    const { error } = await db
        .schema("business")
        .from("telegram_hilo")
        .insert({ chat_id: m.chat.id, message_id: m.message_id, cliente_id: clienteId, pedido_id: pedidoId, mensaje_id: mensajeId })
    if (error) console.error("telegram: no se pudo guardar el hilo:", error.message)
}

/**
 * Cómo mostrar en Telegram que un mensaje responde a otro: respondiendo la copia de ese mensaje en el grupo (la más
 * reciente) o, si no tiene copia, con una línea que lo cita. Nunca lanza: sin datos, el mensaje va sin cita.
 */
async function citaTelegram(cfg: TelegramCfg, db: SupabaseClient, respondeA: number | null): Promise<{ reply: Record<string, unknown>; linea: string }> {
    const sinCita = { reply: {}, linea: "" }
    if (!respondeA) return sinCita
    try {
        const negocio = db.schema("business")
        const { data: hilo } = await negocio
            .from("telegram_hilo")
            .select("message_id")
            .eq("chat_id", Number(cfg.chatId))
            .eq("mensaje_id", respondeA)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        if (hilo) return { reply: { reply_parameters: { message_id: Number(hilo.message_id), allow_sending_without_reply: true } }, linea: "" }
        const { data: original } = await negocio.from("mensaje_asesor").select("texto,adjunto_tipo").eq("id", respondeA).maybeSingle()
        if (!original) return sinCita
        return { reply: {}, linea: `↩️ <i>«${html(recortar(resumenMensaje(original), 80))}»</i>` }
    } catch (e) {
        console.error("telegram: cita de la respuesta:", e instanceof Error ? e.message : e)
        return sinCita
    }
}

/**
 * Tema del cliente en el grupo; lo crea (con una presentación del cliente) si no existe o si `recrear` (lo borraron en
 * Telegram). null = el grupo no tiene Temas: se publica en el grupo.
 */
async function temaDelCliente(cfg: TelegramCfg, db: SupabaseClient, clienteId: string, recrear = false): Promise<number | null> {
    const temas = db.schema("business").from("telegram_tema")
    if (!recrear) {
        const { data } = await temas.select("thread_id").eq("cliente_id", clienteId).eq("chat_id", Number(cfg.chatId)).maybeSingle()
        if (data) return Number(data.thread_id)
    }
    const cliente = await leerCliente(db, clienteId)
    let tema: { message_thread_id: number }
    try {
        const nombre = [cliente?.username, cliente?.email].filter(Boolean).join(" · ") || "Cliente"
        tema = await telegram(cfg, "createForumTopic", { chat_id: cfg.chatId, name: nombre.slice(0, 128) })
    } catch (e) {
        console.warn("telegram: sin tema para el cliente (¿el grupo tiene Temas y el bot puede gestionarlos?):", e instanceof Error ? e.message : e)
        return null
    }
    const { error } = await temas.upsert({ cliente_id: clienteId, chat_id: Number(cfg.chatId), thread_id: tema.message_thread_id })
    if (error) console.error("telegram: no se pudo guardar el tema:", error.message)
    await telegram(cfg, "sendMessage", {
        chat_id: cfg.chatId,
        message_thread_id: tema.message_thread_id,
        parse_mode: "HTML",
        text: `${lineaCliente(cliente)}\n\nEste es el chat con este cliente: lo que escribas aquí le llega en Playr (Mis compras).`,
    }).catch(() => {})
    return tema.message_thread_id
}

/**
 * Envía al tema del cliente (o al grupo si no hay Temas). Si el tema ya no existe en Telegram, lo vuelve a crear y
 * reintenta una vez.
 */
async function enviarAlCliente(
    cfg: TelegramCfg,
    db: SupabaseClient,
    clienteId: string,
    metodo: string,
    body: (thread: number | null) => Record<string, unknown> | FormData,
): Promise<MensajeTg> {
    const thread = await temaDelCliente(cfg, db, clienteId)
    try {
        return await telegram<MensajeTg>(cfg, metodo, body(thread))
    } catch (e) {
        if (thread === null || !/thread not found|TOPIC_DELETED|TOPIC_CLOSED/i.test(e instanceof Error ? e.message : "")) throw e
        return telegram<MensajeTg>(cfg, metodo, body(await temaDelCliente(cfg, db, clienteId, true)))
    }
}

/**
 * Envía al tema del cliente una imagen (foto) o nota de voz del chat, con el texto como pie. Si Telegram no acepta el
 * formato (p. ej. un audio WebM grabado en Chrome), va como archivo. Un texto que no cabe en el pie va antes, aparte.
 */
async function enviarAdjuntoAlCliente(
    cfg: TelegramCfg,
    db: SupabaseClient,
    clienteId: string,
    adjunto: { path: string; tipo: TipoAdjunto },
    texto: string,
    extra: Record<string, unknown> = {},
): Promise<MensajeTg> {
    const { data: archivo, error } = await db.storage.from("chat").download(adjunto.path)
    if (error || !archivo) throw new Error(`no se pudo leer el adjunto: ${error?.message ?? "vacío"}`)

    let caption = texto
    if (caption.length > 1024) {
        await enviarAlCliente(cfg, db, clienteId, "sendMessage", (thread) => ({
            chat_id: cfg.chatId,
            ...(thread !== null ? { message_thread_id: thread } : {}),
            text: caption.slice(0, 4096),
            parse_mode: "HTML",
        }))
        caption = ""
    }
    const enviar = (metodo: string, campo: string) =>
        enviarAlCliente(cfg, db, clienteId, metodo, (thread) => {
            const form = new FormData()
            form.set("chat_id", cfg.chatId)
            if (thread !== null) form.set("message_thread_id", String(thread))
            if (caption) {
                form.set("caption", caption)
                form.set("parse_mode", "HTML")
            }
            for (const [k, v] of Object.entries(extra)) form.set(k, typeof v === "string" ? v : JSON.stringify(v))
            form.set(campo, archivo, adjunto.path.split("/").pop() ?? "adjunto")
            return form
        })

    try {
        return adjunto.tipo === "imagen" ? await enviar("sendPhoto", "photo") : await enviar("sendVoice", "voice")
    } catch (e) {
        console.warn("telegram: adjunto enviado como archivo:", e instanceof Error ? e.message : e)
        return enviar("sendDocument", "document")
    }
}

/**
 * Publica en el tema del cliente el pedido nuevo: comprobante (foto, o archivo si es PDF/HEIC), detalle y botones
 * Aprobar/Rechazar si hay aprobadores. Nunca lanza: si falla, deja un aviso en la campana.
 */
export async function avisarPedidoTelegram(pedidoId: number): Promise<void> {
    const cfg = telegramCfg()
    if (!cfg) return
    const db = createSupabaseAdmin()
    if (!db) return

    try {
        const { data, error } = await db.schema("business").from("pedido").select(PEDIDO_COLUMNAS).eq("id", pedidoId).single()
        if (error || !data) throw new Error(error?.message ?? "pedido no encontrado")
        const pedido = data as unknown as PedidoTg

        const caption = [
            `🔔 <b>Pago por verificar</b>`,
            lineaCliente(await leerCliente(db, pedido.cliente_id)),
            "",
            ...detallePedido(pedido),
            "",
            "Verifica en tu cuenta que el pago llegó antes de aprobar.",
        ].join("\n").slice(0, 1024)

        const botones: { text: string; callback_data?: string; url?: string }[][] = []
        if (cfg.aprobadores.size > 0) {
            botones.push([
                { text: "✅ Aprobar", callback_data: `ap:${pedido.id}` },
                { text: "❌ Rechazar", callback_data: `re:${pedido.id}` },
            ])
        }
        const url = sitio()
        if (url) botones.push([{ text: "Ver en Playr", url: `${url}/administrar/pedidos` }])

        const { data: archivo, error: errArchivo } = await db.storage.from("comprobantes").download(pedido.comprobante_path)
        if (errArchivo || !archivo) throw new Error(`no se pudo leer el comprobante: ${errArchivo?.message ?? "vacío"}`)

        const foto = comprobanteEsImagen(pedido.comprobante_path)
        const enviado = await enviarAlCliente(cfg, db, pedido.cliente_id, foto ? "sendPhoto" : "sendDocument", (thread) => {
            const form = new FormData()
            form.set("chat_id", cfg.chatId)
            if (thread !== null) form.set("message_thread_id", String(thread))
            form.set("caption", caption)
            form.set("parse_mode", "HTML")
            if (botones.length) form.set("reply_markup", JSON.stringify({ inline_keyboard: botones }))
            form.set(foto ? "photo" : "document", archivo, pedido.comprobante_path.split("/").pop() ?? "comprobante")
            return form
        })
        await anotarHilo(db, enviado, pedido.cliente_id, pedido.id)
    } catch (e) {
        await notificar({
            origen: "plataforma",
            tipo: "advertencia",
            titulo: "No se pudo avisar el pedido por Telegram",
            mensaje: `Pedido #${pedidoId}: ${e instanceof Error ? e.message : String(e)}. Revísalo en Pedidos.`,
        })
    }
}

/**
 * Lleva al tema del cliente un mensaje que escribió en Playr, con el detalle del pedido del que habla (o de su último
 * pedido si no eligió uno). Devuelve si llegó; si no, deja un aviso en la campana.
 */
export async function reenviarMensajeAsesor(mensajeId: number): Promise<boolean> {
    const cfg = telegramCfg()
    const db = createSupabaseAdmin()
    if (!cfg || !db) return false

    try {
        const { data: m, error } = await db.schema("business").from("mensaje_asesor").select("id,cliente_id,pedido_id,texto,adjunto_path,adjunto_tipo,responde_a").eq("id", mensajeId).single()
        if (error || !m) throw new Error(error?.message ?? "mensaje no encontrado")

        const pedidos = db.schema("business").from("pedido").select(PEDIDO_COLUMNAS)
        const { data: p } = m.pedido_id
            ? await pedidos.eq("id", m.pedido_id).maybeSingle()
            : await pedidos.eq("cliente_id", m.cliente_id).order("created_at", { ascending: false }).limit(1).maybeSingle()
        const pedido = p as unknown as PedidoTg | null

        // El detalle de un pedido va una sola vez en el chat (con su aviso o con el primer mensaje que lo nombra): el
        // resto llega como mensaje normal, así la conversación se lee bien en Telegram.
        let mostrarPedido = false
        if (pedido) {
            const { count } = await db
                .schema("business")
                .from("telegram_hilo")
                .select("message_id", { count: "exact", head: true })
                .eq("chat_id", Number(cfg.chatId))
                .eq("cliente_id", m.cliente_id)
                .eq("pedido_id", pedido.id)
            mostrarPedido = !count
        }

        const cita = await citaTelegram(cfg, db, m.responde_a)
        const text = [
            ...(cita.linea ? [cita.linea] : []),
            html(m.texto),
            ...(pedido && mostrarPedido ? ["", m.pedido_id ? "<i>Sobre este pedido:</i>" : "<i>Su último pedido:</i>", ...detallePedido(pedido)] : []),
        ].join("\n").trim().slice(0, 4096)

        const url = sitio()
        const extra = {
            ...cita.reply,
            ...(url ? { reply_markup: { inline_keyboard: [[{ text: "Abrir en Playr", url: `${url}/administrar/mensajes?cliente=${m.cliente_id}` }]] } } : {}),
        }
        const enviado = m.adjunto_path
            ? await enviarAdjuntoAlCliente(cfg, db, m.cliente_id, { path: m.adjunto_path, tipo: m.adjunto_tipo }, text, extra)
            : await enviarAlCliente(cfg, db, m.cliente_id, "sendMessage", (thread) => ({
                  chat_id: cfg.chatId,
                  ...(thread !== null ? { message_thread_id: thread } : {}),
                  text,
                  parse_mode: "HTML",
                  ...extra,
              }))
        // Se anota el pedido mostrado (también "su último pedido"), así no se vuelve a repetir.
        await anotarHilo(db, enviado, m.cliente_id, m.pedido_id ?? (mostrarPedido ? pedido?.id ?? null : null), Number(m.id))
        return true
    } catch (e) {
        await notificar({
            origen: "plataforma",
            tipo: "advertencia",
            titulo: "No se pudo llevar un mensaje de cliente a Telegram",
            mensaje: `Mensaje #${mensajeId}: ${e instanceof Error ? e.message : String(e)}.`,
        })
        return false
    }
}

/** Copia al tema del cliente lo que el staff contestó desde Playr. Nunca lanza: si falla, deja un aviso en la campana. */
export async function copiarMensajePanelTelegram(mensajeId: number): Promise<void> {
    const cfg = telegramCfg()
    const db = createSupabaseAdmin()
    if (!cfg || !db) return

    try {
        const { data: m, error } = await db.schema("business").from("mensaje_asesor").select("cliente_id,texto,autor_via,adjunto_path,adjunto_tipo,responde_a").eq("id", mensajeId).single()
        if (error || !m) throw new Error(error?.message ?? "mensaje no encontrado")
        const quien = (m.autor_via ?? "").replace(/^panel:/, "") || "el equipo"
        const cita = await citaTelegram(cfg, db, m.responde_a)
        const text = [`🧑‍💼 <i>${html(quien)} respondió desde Playr:</i>`, ...(cita.linea ? [cita.linea] : []), ...(m.texto ? [html(m.texto)] : [])].join("\n")
        const enviado = m.adjunto_path
            ? await enviarAdjuntoAlCliente(cfg, db, m.cliente_id, { path: m.adjunto_path, tipo: m.adjunto_tipo }, text, cita.reply)
            : await enviarAlCliente(cfg, db, m.cliente_id, "sendMessage", (thread) => ({
                  chat_id: cfg.chatId,
                  ...(thread !== null ? { message_thread_id: thread } : {}),
                  text,
                  parse_mode: "HTML",
                  ...cita.reply,
              }))
        // Sin pedido: así no cuenta como "pedido ya mostrado" en reenviarMensajeAsesor.
        await anotarHilo(db, enviado, m.cliente_id, null, mensajeId)
    } catch (e) {
        await notificar({
            origen: "plataforma",
            tipo: "advertencia",
            titulo: "No se pudo copiar una respuesta a Telegram",
            mensaje: `Mensaje #${mensajeId}: el cliente sí lo recibió en Playr, pero no quedó en Telegram (${e instanceof Error ? e.message : String(e)}).`,
        })
    }
}
