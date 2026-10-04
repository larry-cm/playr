// Solo navegador. Entrega el comprobante de un pedido que espera uno (pago por QR): lo sube a la carpeta del cliente
// en el bucket privado 'comprobantes' (igual que el modal de pago) y lo asocia al pedido. Lo usan el chat con el asesor
// y el archivo compartido desde la app del banco.
import { rutaComprobante, tipoComprobante, validateComprobante } from "@lib/pedido"
import { supabaseTabListo } from "@lib/supabase/client"
import { adjuntarComprobanteAction } from "@action/tienda/adjuntar-comprobante-action"

/** Devuelve el error a mostrar, o null si el comprobante quedó en el pedido (que pasa a "Por verificar"). */
export async function enviarComprobante(pedidoId: number, archivo: File): Promise<string | null> {
    const invalido = validateComprobante(archivo)
    if (invalido) return invalido
    try {
        const supabase = await supabaseTabListo()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return "Tu sesión expiró. Vuelve a iniciar sesión."
        const ruta = rutaComprobante(user.id, archivo)
        const { error } = await supabase.storage.from("comprobantes").upload(ruta, archivo, { contentType: tipoComprobante(archivo), upsert: false })
        if (error) {
            // La RLS del bucket corta a los 5 comprobantes sin pedido en un día (cada intento fallido deja uno).
            return /row-level security/i.test(error.message)
                ? "Ya subiste varios comprobantes hoy sin completar el pedido. Escríbele al asesor por este chat y te ayudamos."
                : "No se pudo subir el comprobante. Revisa tu conexión e inténtalo de nuevo."
        }
        const res = await adjuntarComprobanteAction(pedidoId, ruta)
        return res.ok ? null : res.error
    } catch {
        return "No se pudo enviar el comprobante. Inténtalo de nuevo."
    }
}
