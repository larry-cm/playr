// Webhook del bot de Telegram: atiende los botones del aviso de pedidos (app/lib/telegram.ts). Cada botón pide
// confirmación antes de aprobar o rechazar. Solo actúan los ids de TELEGRAM_APROBADORES; el resto del canal recibe
// "sin permiso". Telegram firma cada llamada con el secreto fijado en setWebhook (X-Telegram-Bot-Api-Secret-Token).
import { timingSafeEqual } from "node:crypto"
import { revalidatePath } from "next/cache"
import { createSupabaseAdmin } from "@lib/supabase/admin"
import { html, telegram, telegramCfg, type TelegramCfg } from "@lib/telegram"

interface CallbackQuery {
    id: string
    from: { id: number; username?: string; first_name?: string }
    data?: string
    message?: { message_id: number; chat: { id: number } }
}

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

    const update = (await request.json().catch(() => null)) as { callback_query?: CallbackQuery } | null
    const cq = update?.callback_query
    // Siempre 200 a Telegram (si no, reintenta la misma actualización); lo que no es un botón se ignora.
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
    const quien = cq.from.username ? `@${cq.from.username}` : (cq.from.first_name ?? String(cq.from.id))
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
