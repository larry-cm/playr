// Job nocturno (Railway cron, 00:00 hora de Colombia): sincroniza el registro de compras guardado
// (business.historial_proveedor) con el sitio del proveedor. Node puro: no importa Next (ni next/headers ni @lib/notify),
// usa la clave secreta (service_role), que business.historial_fusionar acepta desde la migracion 20261003130001.
// La sincronizacion perezosa de la pagina de Bodega sigue igual como respaldo.

import { createClient } from "@supabase/supabase-js"
import { fusionarHistorial } from "@lib/bodega/historial"
import { cfgProveedor, conectar, leerPedidos } from "@lib/bodega/proveedor"
import type { PedidoProveedor } from "@lib/bodega/tipos"

async function main(): Promise<number> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SECRET_KEY
    const cfg = cfgProveedor()
    if (!url || !key || !cfg) {
        console.error("historial-proveedor: faltan variables (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, PLATFORM_URL/EMAIL/PASSWORD)")
        return 1
    }
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

    // Mismo aviso en la campana que sincronizarHistorialAction; business.notificar acepta service_role.
    const avisar = async (origen: "scraping" | "plataforma", titulo: string, e: unknown) => {
        const mensaje = e instanceof Error ? e.message : String(e)
        console.error(`historial-proveedor: ${titulo}: ${mensaje}`)
        const { error } = await supabase.schema("business").rpc("notificar", {
            p_origen: origen, p_tipo: "error", p_titulo: titulo, p_mensaje: mensaje,
        })
        if (error) console.error("historial-proveedor: no se pudo registrar el aviso:", error.message)
    }

    const inicio = Date.now()
    let pedidos: PedidoProveedor[]
    try {
        pedidos = await conectar(cfg).then(leerPedidos)
    } catch (e) {
        await avisar("scraping", "No se pudieron leer los pedidos del proveedor", e)
        return 1
    }
    try {
        const h = await fusionarHistorial(supabase, cfg, pedidos, true)
        console.log(JSON.stringify({
            job: "historial-proveedor", ok: true, leidos: pedidos.length, guardados: h.pedidos.length,
            sincronizado_en: h.sincronizadoEn, ms: Date.now() - inicio,
        }))
        return 0
    } catch (e) {
        await avisar("plataforma", "No se pudo guardar el registro de compras", e)
        return 1
    }
}

main().then(
    (code) => process.exit(code),
    (e) => { console.error("historial-proveedor: error inesperado:", e); process.exit(1) },
)
