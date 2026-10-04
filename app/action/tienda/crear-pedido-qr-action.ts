"use server"

import { after } from "next/server"
import { revalidatePath } from "next/cache"
import { getRoleUser } from "@action/get-role-action"
import { MAX_PERFILES_PEDIDO } from "@lib/pedido"
import { notificar } from "@lib/notify"
import { avisarPedidoEsperandoTelegram } from "@lib/telegram"
import { formatCOP } from "@lib/currency"
import type { CrearPedidoResult } from "@action/tienda/crear-pedido-action"

const SIN_SESION = "Tu sesión expiró. Vuelve a iniciar sesión."
const ERROR_GENERICO = "No se pudo crear el pedido. Inténtalo de nuevo."
/** Tope de cordura del total que manda el navegador (la base exige que sea igual al precio real). */
const TOTAL_MAXIMO = 10_000_000

/**
 * Pago por QR: crea el pedido sin comprobante (business.crear_pedido_qr: mismas guardas que crear_pedido, perfiles
 * reservados, estado 'esperando_comprobante') y la base deja en el chat del cliente el mensaje automático del asesor con
 * el QR de la llave y el monto. El cliente todavía no pagó: si falla, no hay nada que avisar al staff. Después de
 * responder, avisa en la campana y en el tema del cliente en Telegram (sin botones: aún no hay qué verificar).
 */
export async function crearPedidoQrAction(profileIds: number[], totalEsperado: number, llaveId: number): Promise<CrearPedidoResult> {
    if ((await getRoleUser()) === "error") return { ok: false, error: SIN_SESION }
    const { getUsuario } = await import("@lib/supabase/server")
    const { user, supabase } = await getUsuario()
    if (!user) return { ok: false, error: SIN_SESION }

    const ids = Array.isArray(profileIds) ? [...new Set(profileIds.filter((id) => Number.isInteger(id) && id > 0))] : []
    if (ids.length === 0 || ids.length > MAX_PERFILES_PEDIDO) return { ok: false, error: `Elige entre 1 y ${MAX_PERFILES_PEDIDO} perfiles.` }
    if (!Number.isFinite(totalEsperado) || totalEsperado <= 0 || totalEsperado > TOTAL_MAXIMO) return { ok: false, error: ERROR_GENERICO }
    if (!Number.isInteger(llaveId)) return { ok: false, error: "Elige la llave a la que vas a pagar." }

    const { data, error } = await supabase
        .schema("business")
        .rpc("crear_pedido_qr", { p_profile_ids: ids, p_total_esperado: totalEsperado, p_llave_id: llaveId })

    if (error || typeof data !== "number") {
        console.error("crearPedidoQrAction:", error?.message)
        if (error?.code === "42501") return { ok: false, error: SIN_SESION }
        // P0001/22023 son los mensajes pensados para el cliente (sin stock, precio, llave, pedido abierto).
        return { ok: false, error: error && (error.code === "P0001" || error.code === "22023") ? error.message : ERROR_GENERICO }
    }

    const pedidoId = data
    after(async () => {
        await Promise.all([
            notificar({
                origen: "plataforma",
                tipo: "info",
                titulo: "Pago por QR en curso",
                mensaje: `Pedido #${pedidoId} por ${formatCOP(totalEsperado)}: el cliente recibió el QR en el chat y debe enviar el comprobante.`,
            }),
            avisarPedidoEsperandoTelegram(pedidoId),
        ])
    })

    revalidatePath("/administrar/tienda")
    revalidatePath("/administrar/compras")
    revalidatePath("/administrar/pedidos")
    return { ok: true, id: pedidoId }
}
