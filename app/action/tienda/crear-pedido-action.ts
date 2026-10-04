"use server"

import { after } from "next/server"
import { revalidatePath } from "next/cache"
import { getRoleUser } from "@action/get-role-action"
import { esRutaComprobante, MAX_PERFILES_PEDIDO } from "@lib/pedido"
import { notificar } from "@lib/notify"
import { avisarPedidoTelegram } from "@lib/telegram"
import { formatCOP } from "@lib/currency"

export type CrearPedidoResult = { ok: true; id: number } | { ok: false; error: string }

const ERROR_GENERICO = "No se pudo registrar el pago. Inténtalo de nuevo."
/** El cliente ya transfirió cuando llega acá: si el pedido no se crea, el staff debe enterarse para devolver o entregar. */
const AVISO_PAGO = " Si ya transferiste, tu comprobante quedó guardado y avisamos al equipo: te contactaremos."
/** Tope de cordura del total que manda el navegador (la base exige que sea igual al precio real). */
const TOTAL_MAXIMO = 10_000_000

type Supabase = Awaited<ReturnType<typeof import("@lib/supabase/server").getUsuario>>["supabase"]

/** Solo false si Storage confirma que el archivo no está: ante una falla se asume que existe y se avisa igual. */
async function comprobanteExiste(supabase: Supabase, ruta: string): Promise<boolean> {
    const [carpeta, archivo] = ruta.split("/")
    const { data, error } = await supabase.storage.from("comprobantes").list(carpeta, { search: archivo, limit: 1 })
    if (error || !data) return true
    return data.some((o) => o.name === archivo)
}

/**
 * Registra el pedido del cliente con el comprobante ya subido a su carpeta del bucket 'comprobantes'.
 * business.crear_pedido valida todo en la base (perfiles disponibles, precio igual al que vio el cliente, comprobante
 * propio y sin usar, llave elegida visible) y reserva los perfiles. Después de responder, avisa al staff en la campana y
 * en el canal de Telegram. Si falla, deja en la campana el comprobante huérfano (pago sin pedido).
 */
export async function crearPedidoAction(profileIds: number[], comprobantePath: string, totalEsperado: number, llaveId: number): Promise<CrearPedidoResult> {
    if ((await getRoleUser()) === "error") return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." }
    const { getUsuario } = await import("@lib/supabase/server")
    const { user, supabase } = await getUsuario()
    if (!user) return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." }

    const ids = Array.isArray(profileIds) ? [...new Set(profileIds.filter((id) => Number.isInteger(id) && id > 0))] : []
    if (ids.length === 0 || ids.length > MAX_PERFILES_PEDIDO) return { ok: false, error: `Elige entre 1 y ${MAX_PERFILES_PEDIDO} perfiles.` }
    // Solo la ruta que arma rutaComprobante en la carpeta propia: el texto termina en el aviso al staff.
    if (!esRutaComprobante(user.id, comprobantePath)) return { ok: false, error: "Sube el comprobante de pago." }
    if (!Number.isFinite(totalEsperado) || totalEsperado <= 0 || totalEsperado > TOTAL_MAXIMO) return { ok: false, error: ERROR_GENERICO }
    if (!Number.isInteger(llaveId)) return { ok: false, error: "Elige la llave a la que transferiste." }

    const { data, error } = await supabase
        .schema("business")
        .rpc("crear_pedido", { p_profile_ids: ids, p_comprobante: comprobantePath, p_total_esperado: totalEsperado, p_llave_id: llaveId })

    if (error || typeof data !== "number") {
        console.error("crearPedidoAction:", error?.message)
        // Solo hay pago sin pedido si el comprobante existe de verdad: si no, cualquiera llenaría la campana.
        if (!(await comprobanteExiste(supabase, comprobantePath))) return { ok: false, error: "No encontramos el comprobante. Súbelo de nuevo." }
        await notificar({
            origen: "plataforma",
            tipo: "advertencia",
            titulo: "Comprobante sin pedido",
            mensaje: `${user.email ?? "Un cliente"} subió un comprobante por ${formatCOP(totalEsperado)} pero el pedido no se creó (${error?.message ?? "sin respuesta"}). Archivo: comprobantes/${comprobantePath}. Verifica si llegó el pago y contáctalo.`,
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
