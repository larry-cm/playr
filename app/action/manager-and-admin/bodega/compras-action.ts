"use server"

import { getRoleUser } from "@action/get-role-action"
import { cfgProveedor, conectar, leerPedidos } from "@lib/bodega/proveedor"
import type { PedidoProveedor } from "@lib/bodega/tipos"
import { notificar } from "@lib/notify"

/**
 * Registro GLOBAL de compras: todos los pedidos de la cuenta del proveedor (hechos desde Bodega o a mano en su sitio), leídos en
 * vivo. Solo admin/manager. null = no se pudo leer.
 */
export async function getPedidosProveedorAction(): Promise<PedidoProveedor[] | null> {
    const role = await getRoleUser()
    if (role !== "admin" && role !== "manager") return null

    const cfg = cfgProveedor()
    if (!cfg) return null

    try {
        return await conectar(cfg).then(leerPedidos)
    } catch (e) {
        await notificar({ origen: "scraping", tipo: "error", titulo: "No se pudieron leer los pedidos del proveedor", mensaje: e })
        return null
    }
}
