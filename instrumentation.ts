// Solo en desarrollo: el webhook de Telegram necesita una URL pública, así que en local se leen las actualizaciones
// del bot de PRUEBAS por polling (getUpdates) y se le pasan a la misma ruta /api/telegram que usa producción.
// Se enciende con TELEGRAM_POLLING=1 en .env.telegram.dev (ver CLAUDE.md §21): nunca con el bot de producción, que
// tiene webhook (Telegram rechaza getUpdates mientras haya uno, y no se borra desde acá).

export async function register() {
    if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV === "production") return
    if (process.env.TELEGRAM_POLLING !== "1") return
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
    const secreto = process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
    if (!token || !secreto) return

    // Con recarga en caliente register() puede correr otra vez: un solo bucle por proceso.
    const g = globalThis as { __playrTelegramPolling?: boolean }
    if (g.__playrTelegramPolling) return
    g.__playrTelegramPolling = true

    const destino = `http://localhost:${process.env.PORT ?? 3000}/api/telegram`
    const api = `https://api.telegram.org/bot${token}`
    let offset = 0
    console.log("[telegram] polling del bot de pruebas →", destino)

    const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms))
    void (async () => {
        for (;;) {
            try {
                const res = await fetch(`${api}/getUpdates`, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ offset, timeout: 25, allowed_updates: ["callback_query", "message"] }),
                    signal: AbortSignal.timeout(35_000),
                })
                const json = (await res.json()) as { ok: boolean; result?: { update_id: number }[]; description?: string }
                if (!json.ok) {
                    console.error("[telegram] getUpdates:", json.description, "(¿el bot de pruebas tiene webhook? usa deleteWebhook)")
                    await pausa(30_000)
                    continue
                }
                for (const update of json.result ?? []) {
                    offset = update.update_id + 1
                    await fetch(destino, {
                        method: "POST",
                        headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": secreto },
                        body: JSON.stringify(update),
                    }).catch((e) => console.error("[telegram] no se pudo pasar la actualización a /api/telegram:", e))
                }
            } catch {
                await pausa(5_000)
            }
        }
    })()
}
