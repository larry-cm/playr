"use server"

import { after } from "next/server"
import { revalidatePath } from "next/cache"
import { esRutaComprobante } from "@lib/pedido"
import { notificar } from "@lib/notify"
import { avisarPedidoTelegram } from "@lib/telegram"

const SIN_SESION = "Tu sesión expiró. Vuelve a iniciar sesión."

/**
 * Entrega el comprobante (ya subido a la carpeta del cliente en 'comprobantes') del pedido que espera uno.
 * business.adjuntar_comprobante valida dueño, archivo y estado, pasa el pedido a 'pendiente' y deja el comprobante como
 * mensaje del cliente en el chat. Después de responder, avisa al staff como un pedido nuevo (campana y Telegram con
 * Aprobar/Rechazar). Si falla, el pedido sigue esperando: el cliente lo vuelve a intentar desde el chat.
 */
export async function adjuntarComprobanteAction(pedidoId: number, comprobantePath: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const { getUsuario } = await import("@lib/supabase/server")
    const { user, supabase } = await getUsuario()
    if (!user) return { ok: false, error: SIN_SESION }
    if (!Number.isInteger(pedidoId) || pedidoId <= 0) return { ok: false, error: "Pedido no encontrado." }
    // Solo la ruta que arma rutaComprobante en la carpeta propia.
    if (!esRutaComprobante(user.id, comprobantePath)) return { ok: false, error: "Sube el comprobante de pago." }

    const { data, error } = await supabase.schema("business").rpc("adjuntar_comprobante", { p_pedido_id: pedidoId, p_comprobante: comprobantePath })
    if (error || typeof data !== "number") {
        console.error("adjuntarComprobanteAction:", error?.message)
        if (error?.code === "42501") return { ok: false, error: SIN_SESION }
        return { ok: false, error: error && (error.code === "P0001" || error.code === "22023") ? error.message : "No se pudo enviar el comprobante. Inténtalo de nuevo." }
    }

    after(async () => {
        await Promise.all([
            notificar({
                origen: "plataforma",
                tipo: "info",
                titulo: "Pago por verificar",
                mensaje: `Pedido #${pedidoId} (pago por QR): el cliente envió el comprobante por el chat. Revísalo en Pedidos.`,
            }),
            avisarPedidoTelegram(pedidoId),
        ])
    })

    revalidatePath("/administrar/compras")
    revalidatePath("/administrar/pedidos")
    return { ok: true }
}
