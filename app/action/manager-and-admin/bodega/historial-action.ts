"use server"

import { esStaff } from "@lib/auth"
import { fusionarHistorial, leerHistorial } from "@lib/bodega/historial"
import { cfgProveedor, conectar, leerPedidos } from "@lib/bodega/proveedor"
import type { HistorialProveedor, PedidoProveedor } from "@lib/bodega/tipos"
import { notificar } from "@lib/notify"

/**
 * Registro GLOBAL de compras (todos los pedidos de la cuenta del proveedor, hechos desde Bodega o a mano en su sitio) tal como
 * quedó guardado en la base: no consulta el sitio, es rápido. Solo admin/manager. null = sin permiso, sin configuración o error.
 */
export async function getHistorialAction(): Promise<HistorialProveedor | null> {
    if (!(await esStaff())) return null
    const cfg = cfgProveedor()
    if (!cfg) return null

    const { createSupabase } = await import("@lib/supabase/server")
    return leerHistorial(await createSupabase(), cfg)
}

/**
 * Lee TODOS los pedidos del sitio del proveedor (login en frío + "Mis pedidos" + "Mis licencias": lento) y los fusiona con lo
 * guardado. Solo admin/manager. null = no se pudo (queda el aviso en la campana; lo guardado no se toca).
 */
export async function sincronizarHistorialAction(): Promise<HistorialProveedor | null> {
    if (!(await esStaff())) return null
    const cfg = cfgProveedor()
    if (!cfg) return null

    let pedidos: PedidoProveedor[]
    try {
        pedidos = await conectar(cfg).then(leerPedidos)
    } catch (e) {
        await notificar({ origen: "scraping", tipo: "error", titulo: "No se pudieron leer los pedidos del proveedor", mensaje: e })
        return null
    }

    try {
        const { createSupabase } = await import("@lib/supabase/server")
        return await fusionarHistorial(await createSupabase(), cfg, pedidos, true)
    } catch (e) {
        await notificar({ origen: "plataforma", tipo: "error", titulo: "No se pudo guardar el registro de compras", mensaje: e })
        return null
    }
}
