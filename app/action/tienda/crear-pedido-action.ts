"use server"

import { after } from "next/server"
import { revalidatePath } from "next/cache"
import { getRoleUser } from "@action/get-role-action"
import { MAX_PERFILES_PEDIDO } from "@lib/pedido"
import { notificar } from "@lib/notify"
import { avisarPedidoTelegram } from "@lib/telegram"
import { formatCOP } from "@lib/currency"

export type CrearPedidoResult = { ok: true; id: number } | { ok: false; error: string }

const ERROR_GENERICO = "No se pudo registrar el pago. Inténtalo de nuevo."
/** El cliente ya transfirió cuando llega acá: si el pedido no se crea, el staff debe enterarse para devolver o entregar. */
const AVISO_PAGO = " Si ya transferiste, tu comprobante quedó guardado y avisamos al equipo: te contactaremos."

/**
 * Registra el pedido del cliente con el comprobante ya subido a su carpeta del bucket 'comprobantes'.
 * business.crear_pedido valida todo en la base (perfiles disponibles, precio igual al que vio el cliente, comprobante
 * propio y sin usar, llave configurada) y reserva los perfiles. Después de responder, avisa al staff en la campana y
 * en el canal de Telegram. Si falla, deja en la campana el comprobante huérfano (pago sin pedido).
 */
export async function crearPedidoAction(profileIds: number[], comprobantePath: string, totalEsperado: number): Promise<CrearPedidoResult> {
    if ((await getRoleUser()) === "error") return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." }

    const ids = Array.isArray(profileIds) ? [...new Set(profileIds.filter((id) => Number.isInteger(id) && id > 0))] : []
    if (ids.length === 0 || ids.length > MAX_PERFILES_PEDIDO) return { ok: false, error: `Elige entre 1 y ${MAX_PERFILES_PEDIDO} perfiles.` }
    if (typeof comprobantePath !== "string" || !comprobantePath) return { ok: false, error: "Sube el comprobante de pago." }
    if (!Number.isFinite(totalEsperado)) return { ok: false, error: ERROR_GENERICO }

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    const { data, error } = await supabase
        .schema("business")
        .rpc("crear_pedido", { p_profile_ids: ids, p_comprobante: comprobantePath, p_total_esperado: totalEsperado })

    if (error || typeof data !== "number") {
        console.error("crearPedidoAction:", error?.message)
        const { data: { user } } = await supabase.auth.getUser()
        await notificar({
            origen: "plataforma",
            tipo: "advertencia",
            titulo: "Comprobante sin pedido",
            mensaje: `${user?.email ?? "Un cliente"} subió un comprobante por ${formatCOP(totalEsperado)} pero el pedido no se creó (${error?.message ?? "sin respuesta"}). Archivo: comprobantes/${comprobantePath}. Verifica si llegó el pago y contáctalo.`,
        })
        // P0001/22023 son los mensajes pensados para el cliente (sin stock, precio, comprobante, límite de pendientes).
        const motivo = error && (error.code === "P0001" || error.code === "22023") ? error.message : ERROR_GENERICO
        return { ok: false, error: motivo + AVISO_PAGO }
    }

    const pedidoId = data
    after(async () => {
        await Promise.all([
            notificar({
                origen: "plataforma",
                tipo: "info",
                titulo: "Pago por verificar",
                mensaje: `Pedido #${pedidoId} por ${formatCOP(totalEsperado)}. Revisa el comprobante en Pedidos.`,
            }),
            avisarPedidoTelegram(pedidoId),
        ])
    })

    revalidatePath("/administrar/tienda")
    revalidatePath("/administrar/compras")
    revalidatePath("/administrar/pedidos")
    return { ok: true, id: pedidoId }
}
