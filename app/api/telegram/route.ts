// Webhook del bot de Telegram (app/lib/telegram.ts):
// - Botones del aviso de pedidos: cada uno pide confirmación antes de aprobar o rechazar.
// - Mensajes del asesor: lo que escribe en el tema de un cliente (business.telegram_tema) le llega a ese cliente en su
//   chat de Mis compras. En un grupo sin Temas, responde el mensaje del cliente (business.telegram_hilo).
// Solo actúan los ids de TELEGRAM_APROBADORES. Telegram firma cada llamada con el secreto fijado en setWebhook
// (X-Telegram-Bot-Api-Secret-Token). En local, instrumentation.ts le pasa las actualizaciones del bot de pruebas.
import { timingSafeEqual } from "node:crypto"
import { after } from "next/server"
import { revalidatePath } from "next/cache"
import { precalentarLicencias } from "@lib/claves"
import { createSupabaseAdmin } from "@lib/supabase/admin"
import { descargarTelegram, html, telegram, telegramCfg, type TelegramCfg } from "@lib/telegram"
import { ADJUNTO_MAX_BYTES, mimeAdjunto, rutaAdjunto, type TipoAdjunto } from "@lib/chat-adjunto"

interface Usuario { id: number; username?: string; first_name?: string }

interface CallbackQuery {
    id: string
    from: Usuario
    data?: string
    message?: { message_id: number; chat: { id: number } }
}

interface ArchivoTg { file_id: string; file_size?: number; mime_type?: string }

interface Mensaje {
    message_id: number
    from?: Usuario & { is_bot?: boolean }
    chat: { id: number; type: string }
    text?: string
    caption?: string
    photo?: ArchivoTg[]
    voice?: ArchivoTg
    audio?: ArchivoTg
    document?: ArchivoTg
    /** Contenido que al cliente no le llega. */
    sticker?: unknown
    video?: unknown
    video_note?: unknown
    animation?: unknown
    message_thread_id?: number
    is_topic_message?: boolean
    reply_to_message?: { message_id: number }
}

const nombre = (u: Usuario) => (u.username ? `@${u.username}` : (u.first_name ?? String(u.id)))

const ok = () => new Response("ok")

const mismoSecreto = (a: string, b: string) => {
    const x = Buffer.from(a)
    const y = Buffer.from(b)
    return x.length === y.length && timingSafeEqual(x, y)
}

type Teclado = { text: string; callback_data: string }[][]

const botones = (id: number): Teclado => [[
    { text: "✅ Aprobar", callback_data: `ap:${id}` },
    { text: "❌ Rechazar", callback_data: `re:${id}` },
]]

const confirmar = (id: number, accion: "ap" | "re"): Teclado => [[
    { text: accion === "ap" ? `Sí, aprobar #${id}` : `Sí, rechazar #${id}`, callback_data: `${accion}!:${id}` },
    { text: "Volver", callback_data: `no:${id}` },
]]

export async function POST(request: Request) {
    const cfg = telegramCfg()
    if (!cfg?.webhookSecret) return new Response("not configured", { status: 404 })
    if (!mismoSecreto(request.headers.get("x-telegram-bot-api-secret-token") ?? "", cfg.webhookSecret)) {
        return new Response("forbidden", { status: 403 })
    }

    const update = (await request.json().catch(() => null)) as { callback_query?: CallbackQuery; message?: Mensaje } | null
    // Siempre 200 a Telegram (si no, reintenta la misma actualización); lo que no es un botón ni un mensaje se ignora.
    if (update?.message) {
        await atenderMensaje(cfg, update.message).catch((e) => console.error("telegram webhook (mensaje):", e))
        return ok()
    }
    const cq = update?.callback_query
    if (!cq?.data || !cq.message) return ok()

    try {
        await atender(cfg, cq)
    } catch (e) {
        console.error("telegram webhook:", e)
        await telegram(cfg, "answerCallbackQuery", { callback_query_id: cq.id, text: "No se pudo procesar. Inténtalo de nuevo o usa el panel.", show_alert: true }).catch(() => {})
    }
    return ok()
}

async function atender(cfg: TelegramCfg, cq: CallbackQuery) {
    const responder = (text: string, show_alert = false) => telegram(cfg, "answerCallbackQuery", { callback_query_id: cq.id, text, show_alert })

    if (!cfg.aprobadores.has(String(cq.from.id))) {
        await responder("No tienes permiso para revisar pedidos.", true)
        return
    }
    // Los botones de pedidos solo valen en el grupo del equipo: un callback desde otro chat (mensaje reenviado o
    // armado a mano) no aprueba nada.
    if (String(cq.message?.chat.id) !== cfg.chatId) {
        await responder("Revisa los pedidos desde el grupo del equipo.", true)
        return
    }

    const match = /^(ap|re|ap!|re!|no):(\d+)$/.exec(cq.data ?? "")
    if (!match) {
        await responder("Botón no reconocido.")
        return
    }
    const [, accion, idTexto] = match
    const id = Number(idTexto)
    const mensaje = { chat_id: cq.message!.chat.id, message_id: cq.message!.message_id }
    const teclado = (inline_keyboard: Teclado) => telegram(cfg, "editMessageReplyMarkup", { ...mensaje, reply_markup: { inline_keyboard } })

    if (accion === "ap" || accion === "re") {
        await teclado(confirmar(id, accion))
        await responder(accion === "ap" ? "Confirma la aprobación" : "Confirma el rechazo")
        return
    }
    if (accion === "no") {
        await teclado(botones(id))
        await responder("Sin cambios")
        return
    }

    const db = createSupabaseAdmin()
    if (!db) throw new Error("Falta SUPABASE_SECRET_KEY")
    const quien = nombre(cq.from)
    const via = `telegram:${quien}`.slice(0, 80)
    const aprobar = accion === "ap!"
    const { error } = aprobar
        ? await db.schema("business").rpc("aprobar_pedido", { p_pedido_id: id, p_via: via })
        : await db.schema("business").rpc("rechazar_pedido", { p_pedido_id: id, p_motivo: "No pudimos verificar el pago.", p_via: via })

    if (error) {
        // P0001 = ya revisado (desde el panel u otro aprobador): se quitan los botones para que no se vuelva a intentar.
        if (error.code === "P0001") await teclado([])
        await responder(error.code === "P0001" || error.code === "P0002" ? error.message : "No se pudo guardar. Usa el panel.", true)
        return
    }

    if (aprobar) after(() => precalentarLicencias(db))
    revalidatePath("/administrar/pedidos")
    revalidatePath("/administrar/compras")
    revalidatePath("/administrar/tienda")
    await teclado([])
    await telegram(cfg, "sendMessage", {
        chat_id: mensaje.chat_id,
        reply_parameters: { message_id: mensaje.message_id },
        parse_mode: "HTML",
        text: aprobar
            ? `✅ Pedido #${id} <b>aprobado</b> por ${html(quien)}. El cliente ya ve sus accesos en Mis compras.`
            : `❌ Pedido #${id} <b>rechazado</b> por ${html(quien)}. Sus perfiles volvieron a la Tienda.`,
    })
    await responder(aprobar ? "Pedido aprobado" : "Pedido rechazado")
}

/**
 * Archivo del mensaje que se le puede mandar al cliente: foto (la más grande), nota de voz, audio, o una imagen/audio
 * enviada como archivo. null = solo texto; "no" = otro contenido (sticker, video, documento…).
 */
function adjuntoDe(m: Mensaje): (ArchivoTg & { mime: string; tipo: TipoAdjunto }) | null | "no" {
    if (m.photo?.length) return { ...m.photo[m.photo.length - 1], mime: "image/jpeg", tipo: "imagen" }
    const a = m.voice ?? m.audio ?? m.document
    if (!a) return m.sticker || m.video || m.video_note || m.animation ? "no" : null
    const mime = mimeAdjunto(a.mime_type ?? (m.voice ? "audio/ogg" : ""))
    if (!mime) return "no"
    return { ...a, mime, tipo: mime.startsWith("image/") ? "imagen" : "audio" }
}

/** Mensaje del asesor para un cliente: escrito en el tema del cliente o, sin Temas, respondiendo su mensaje. */
async function atenderMensaje(cfg: TelegramCfg, m: Mensaje) {
    if (!m.from || m.from.is_bot || !cfg.aprobadores.has(String(m.from.id))) return
    const decir = (text: string) =>
        telegram(cfg, "sendMessage", { chat_id: m.chat.id, text, parse_mode: "HTML", reply_parameters: { message_id: m.message_id } })

    if (m.chat.type === "private") {
        if (m.text?.startsWith("/start")) await decir("Hola. Los mensajes de los clientes llegan al grupo del equipo, cada cliente en su propio tema: escribe ahí para contestarle.")
        return
    }

    const db = createSupabaseAdmin()
    if (!db) throw new Error("Falta SUPABASE_SECRET_KEY")
    const negocio = db.schema("business")

    let destino: { cliente_id: string; pedido_id: number | null } | null = null
    if (m.is_topic_message && m.message_thread_id) {
        const { data } = await negocio.from("telegram_tema").select("cliente_id").eq("chat_id", m.chat.id).eq("thread_id", m.message_thread_id).maybeSingle()
        if (data) destino = { cliente_id: data.cliente_id, pedido_id: null }
    } else if (m.reply_to_message) {
        const { data } = await negocio.from("telegram_hilo").select("cliente_id,pedido_id").eq("chat_id", m.chat.id).eq("message_id", m.reply_to_message.message_id).maybeSingle()
        destino = data
    }
    // Conversación del equipo (tema General u otro mensaje): no es para un cliente.
    if (!destino) return

    const texto = (m.text ?? m.caption ?? "").trim()
    if (texto.startsWith("/")) return

    // Foto, nota de voz o audio: se copia al bucket del chat, en la carpeta del cliente.
    let adjunto: { path: string; tipo: TipoAdjunto } | null = null
    const archivo = adjuntoDe(m)
    if (archivo === "no") {
        await decir("Al cliente le llegan textos, fotos y notas de voz. Este tipo de mensaje no se le envió.")
        return
    }
    if (archivo) {
        if ((archivo.file_size ?? 0) > ADJUNTO_MAX_BYTES) {
            await decir("El archivo pesa más de 10 MB: no se le envió al cliente.")
            return
        }
        const path = rutaAdjunto(destino.cliente_id, archivo.mime, "tg-")
        const subido = await descargarTelegram(cfg, archivo.file_id)
            .then((datos) => db.storage.from("chat").upload(path, datos, { contentType: archivo.mime, upsert: false }))
            .catch((e: unknown) => ({ error: e instanceof Error ? e : new Error(String(e)) }))
        if (subido.error) {
            console.error("telegram webhook: copiar adjunto", subido.error.message)
            await decir("No se pudo enviar el archivo al cliente. Inténtalo de nuevo.")
            return
        }
        adjunto = { path, tipo: archivo.tipo }
    } else if (!texto) return

    const { error } = await negocio.from("mensaje_asesor").insert({
        cliente_id: destino.cliente_id,
        pedido_id: destino.pedido_id,
        autor: "asesor",
        texto: texto.slice(0, 1000),
        autor_via: `telegram:${nombre(m.from)}`.slice(0, 80),
        adjunto_path: adjunto?.path ?? null,
        adjunto_tipo: adjunto?.tipo ?? null,
    })
    if (error) {
        console.error("telegram webhook: guardar respuesta", error.message)
        await decir("No se pudo enviar tu mensaje al cliente. Inténtalo de nuevo.")
        return
    }
    revalidatePath("/administrar/compras")
    await telegram(cfg, "setMessageReaction", { chat_id: m.chat.id, message_id: m.message_id, reaction: [{ type: "emoji", emoji: "👍" }] })
        .catch(() => decir("✅ Enviado al cliente."))
}
