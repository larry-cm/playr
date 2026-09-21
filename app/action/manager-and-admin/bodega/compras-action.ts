"use server"

import { revalidatePath } from "next/cache"
import { getRoleUser } from "@action/get-role-action"
import { bodegaDb, leerCompras } from "@lib/bodega/db"
import { reintentarRegistro } from "@lib/bodega/compra"
import { cfgProveedor } from "@lib/bodega/proveedor"
import type { CompraHistorial, ResultadoCompraUI } from "@lib/bodega/tipos"
import { notificar } from "@lib/notify"

/** Últimas compras hechas desde la bodega (quién compró, qué, cuánto y cómo terminó). Solo admin/manager (RLS también lo exige). */
export async function getComprasBodegaAction(): Promise<CompraHistorial[] | null> {
    const role = await getRoleUser()
    if (role !== "admin" && role !== "manager") return null

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    try {
        return await leerCompras(supabase)
    } catch {
        return null
    }
}

/**
 * Reintenta registrar en el inventario la entrega de una compra YA PAGADA que quedó pendiente. No compra nada: solo vuelve a
 * leer las licencias de ese pedido y las registra (sin duplicar las que ya estén).
 */
export async function reintentarRegistroAction(compraId: number): Promise<ResultadoCompraUI> {
    const role = await getRoleUser()
    if (role !== "admin" && role !== "manager") return { ok: false, nivel: "error", mensaje: "No tienes permiso para esta acción." }
    if (!Number.isInteger(compraId) || compraId <= 0) return { ok: false, nivel: "error", mensaje: "Compra inválida." }

    const cfg = cfgProveedor()
    const encKey = process.env.ACCOUNT_ENC_KEY
    if (!cfg || !encKey) return { ok: false, nivel: "error", mensaje: "Falta configuración del proveedor en el servidor." }

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()

    const r = await reintentarRegistro(compraId, { db: bodegaDb(supabase, encKey), cfg, avisar: notificar })
    if (!r.ok) return { ok: false, nivel: "error", mensaje: r.error }

    revalidatePath("/administrar/productos")
    revalidatePath("/administrar/tienda")
    return { ok: true, nivel: r.estado === "registrada" ? "success" : "warning", mensaje: r.detalle, estado: r.estado }
}
