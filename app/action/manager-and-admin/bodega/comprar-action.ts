"use server"

import { getRoleUser } from "@action/get-role-action"
import { bodegaDb } from "@lib/bodega/db"
import { comprar } from "@lib/bodega/compra"
import { cfgProveedor } from "@lib/bodega/proveedor"
import { comprarSchema, firstErrorOfBodega } from "@lib/bodega/schema"
import type { ResultadoCompraUI } from "@lib/bodega/tipos"
import { notificar } from "@lib/notify"

const error = (mensaje: string, extra: Partial<ResultadoCompraUI> = {}): ResultadoCompraUI => ({ ok: false, mensaje, nivel: "error", ...extra })

/**
 * Compra en el proveedor con el saldo de su monedero; el pedido queda en el registro de compras. GASTA DINERO REAL.
 * Todo lo que llega del cliente se trata como no confiable: el rol se verifica aquí (las server actions son endpoints públicos
 * para cualquier sesión), y producto, precio, stock y saldo se re-verifican EN VIVO antes de pagar (ver app/lib/bodega/compra.ts).
 */
export async function comprarBodegaAction(formData: {
    listing_id: number
    cantidad: number
    precio: number
    request_id: string
}): Promise<ResultadoCompraUI> {
    const role = await getRoleUser()
    if (role !== "admin" && role !== "manager") return error("No tienes permiso para comprar en la bodega.")

    const data = comprarSchema.safeParse(formData)
    if (!data.success) return error(firstErrorOfBodega(data.error))

    const cfg = cfgProveedor()
    if (!cfg) return error("Falta configuración del proveedor en el servidor. No se compró nada.")

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()

    const r = await comprar(
        { requestId: data.data.request_id, listingId: data.data.listing_id, cantidad: data.data.cantidad, precioConfirmado: data.data.precio },
        {
            db: bodegaDb(supabase),
            cfg,
            avisar: notificar,
            // Interruptor del servidor (no del cliente): con BODEGA_SIMULAR=1 todo se verifica contra el sitio real pero NO se paga.
            simular: process.env.BODEGA_SIMULAR === "1",
        },
    )

    if (!r.ok) return error(r.error, { estado: r.estado, precioActual: r.precioActual, saldo: r.saldo })
    if (r.simulado) return { ok: true, nivel: "info", mensaje: r.mensaje, saldo: r.saldo, simulado: true, estado: r.compra.estado }

    const mensaje = ["Compra realizada.", r.mensaje, ...r.advertencias].join(" ")
    return { ok: true, nivel: r.advertencias.length > 0 ? "warning" : "success", mensaje, saldo: r.saldo, estado: r.compra.estado }
}
