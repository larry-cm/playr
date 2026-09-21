"use server"

import { getRoleUser } from "@action/get-role-action"
import { cfgProveedor, conectar, leerSaldo } from "@lib/bodega/proveedor"
import type { SaldoProveedor } from "@lib/bodega/tipos"
import { notificar } from "@lib/notify"

/**
 * Saldo REAL del monedero en el proveedor (se lee de su sitio en cada llamada; nunca se guarda en la DB, asi no puede quedar
 * desactualizado). Solo admin/manager. null = no se pudo leer (la UI muestra el error y permite reintentar).
 */
export async function getSaldoProveedorAction(): Promise<SaldoProveedor | null> {
    const role = await getRoleUser()
    if (role !== "admin" && role !== "manager") return null

    const cfg = cfgProveedor()
    if (!cfg) return null

    try {
        const sesion = await conectar(cfg)
        return { saldo: await leerSaldo(sesion), leidoEn: new Date().toISOString() }
    } catch (e) {
        await notificar({ origen: "scraping", tipo: "error", titulo: "No se pudo leer el saldo del proveedor", mensaje: e })
        return null
    }
}
