// Solo servidor. Aviso de pedidos nuevos al canal de Telegram del asesor, con el comprobante y botones para aprobar o
// rechazar (los atiende app/api/telegram/route.ts). Sin TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID no hace nada: el pedido
// igual se revisa en /administrar/pedidos y la campana avisa.
import { createSupabaseAdmin } from "@lib/supabase/admin"
import { notificar } from "@lib/notify"
import { formatCOP } from "@lib/currency"

const API = "https://api.telegram.org"

export interface TelegramCfg {
    token: string
    chatId: string
    /** Ids de usuario de Telegram que pueden aprobar/rechazar con los botones. Vacío = sin botones. */
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

/** Escapa texto para parse_mode HTML. */
export const html = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const TIPO: Record<string, string> = { completa: "Cuenta completa", pantalla: "Pantalla" }

/**
 * Publica en el canal el pedido nuevo: comprobante (foto o PDF), cliente, perfiles, total y llave, con botones
 * Aprobar/Rechazar si hay aprobadores configurados. Nunca lanza: si falla, deja un aviso en la campana.
 */
export async function avisarPedidoTelegram(pedidoId: number): Promise<void> {
    const cfg = telegramCfg()
    if (!cfg) return
    const db = createSupabaseAdmin()
    if (!db) return

    try {
        const { data: pedido, error } = await db
            .schema("business")
            .from("pedido")
            .select("id,cliente_id,total,llave_breb,comprobante_path,created_at,pedido_item(platform_nombre,perfil_nombre,access_type,precio)")
            .eq("id", pedidoId)
            .single()
        if (error || !pedido) throw new Error(error?.message ?? "pedido no encontrado")

        const { data: cliente } = await db.schema("security").from("client").select("username,email,phone").eq("id", pedido.cliente_id).maybeSingle()

        const items = (pedido.pedido_item ?? []) as { platform_nombre: string; perfil_nombre: string; access_type: string; precio: number }[]
        const caption = [
            `🧾 <b>Pago por verificar · Pedido #${pedido.id}</b>`,
            "",
            `👤 ${html(cliente?.username ?? "Cliente")}${cliente?.email ? ` · ${html(cliente.email)}` : ""}${cliente?.phone ? ` · ${html(cliente.phone)}` : ""}`,
            "",
            ...items.map((i) => `• ${html(i.platform_nombre)} · ${html(TIPO[i.access_type] ?? i.access_type)} · ${html(i.perfil_nombre)} — ${html(formatCOP(Number(i.precio)))}`),
            "",
            `💰 <b>Total: ${html(formatCOP(Number(pedido.total)))}</b>`,
            `🔑 Llave: <code>${html(pedido.llave_breb)}</code>`,
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
        const sitio = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "")
        if (sitio?.startsWith("https://")) botones.push([{ text: "Ver en Playr", url: `${sitio}/administrar/pedidos` }])

        const { data: archivo, error: errArchivo } = await db.storage.from("comprobantes").download(pedido.comprobante_path)
        if (errArchivo || !archivo) throw new Error(`no se pudo leer el comprobante: ${errArchivo?.message ?? "vacío"}`)

        const esPdf = archivo.type === "application/pdf" || pedido.comprobante_path.endsWith(".pdf")
        const form = new FormData()
        form.set("chat_id", cfg.chatId)
        form.set("caption", caption)
        form.set("parse_mode", "HTML")
        if (botones.length) form.set("reply_markup", JSON.stringify({ inline_keyboard: botones }))
        form.set(esPdf ? "document" : "photo", archivo, pedido.comprobante_path.split("/").pop() ?? "comprobante")

        await telegram(cfg, esPdf ? "sendDocument" : "sendPhoto", form)
    } catch (e) {
        await notificar({
            origen: "plataforma",
            tipo: "advertencia",
            titulo: "No se pudo avisar el pedido por Telegram",
            mensaje: `Pedido #${pedidoId}: ${e instanceof Error ? e.message : String(e)}. Revísalo en Pedidos.`,
        })
    }
}
