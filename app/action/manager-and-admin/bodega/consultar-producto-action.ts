"use server"

import { esStaff, SIN_PERMISO } from "@lib/auth"
import { bodegaDb } from "@lib/bodega/db"
import { consultarEnVivo } from "@lib/bodega/compra"
import { cfgProveedor } from "@lib/bodega/proveedor"
import type { ConsultaEnVivo } from "@lib/bodega/tipos"
import { notificar } from "@lib/notify"

/**
 * Precio, stock y saldo EN VIVO de un producto de la bodega, para el modal de compra. Solo admin/manager. SOLO LEE: no toca el
 * carrito del proveedor ni paga (ver consultarEnVivo en app/lib/bodega/compra.ts). Al comprar, el servidor vuelve a verificar todo.
 */
export async function consultarProductoBodegaAction(listingId: number): Promise<ConsultaEnVivo> {
    if (!(await esStaff())) return { ok: false, error: SIN_PERMISO }
    if (!Number.isInteger(listingId) || listingId <= 0) return { ok: false, error: "Producto inválido." }

    const cfg = cfgProveedor()
    if (!cfg) return { ok: false, error: "Falta configuración del proveedor en el servidor." }

    const { createSupabase } = await import("@lib/supabase/server")
    const listing = await bodegaDb(await createSupabase()).listing(listingId)
    if (!listing) return { ok: false, error: "No encontré ese producto en la bodega." }

    try {
        return await consultarEnVivo(listing.nombre, { cfg, avisar: notificar })
    } catch (e) {
        console.error("bodega: consulta en vivo:", e)
        return { ok: false, error: "No pude verificar el producto en el proveedor." }
    }
}
