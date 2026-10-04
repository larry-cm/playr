"use server"

import { after } from "next/server"
import { revalidatePath } from "next/cache"
import { esStaff, SIN_PERMISO } from "@lib/auth"
import { precalentarLicencias } from "@lib/claves"

export type RevisarPedidoResult = { ok: true } | { ok: false; error: string }

/**
 * Aprueba (perfiles a vendido; el cliente ve sus accesos) o rechaza (perfiles de vuelta a la Tienda) un pedido
 * pendiente. Solo admin/manager; business.aprobar_pedido/rechazar_pedido lo vuelven a exigir y fallan si el pedido
 * ya fue revisado (p. ej. desde Telegram).
 */
export async function revisarPedidoAction(pedidoId: number, decision: "aprobar" | "rechazar", motivo = ""): Promise<RevisarPedidoResult> {
    if (!(await esStaff())) return { ok: false, error: SIN_PERMISO }
    if (!Number.isInteger(pedidoId) || (decision !== "aprobar" && decision !== "rechazar")) return { ok: false, error: "Datos no válidos." }

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    const db = supabase.schema("business")
    const { error } = decision === "aprobar"
        ? await db.rpc("aprobar_pedido", { p_pedido_id: pedidoId, p_via: "panel" })
        : await db.rpc("rechazar_pedido", { p_pedido_id: pedidoId, p_motivo: String(motivo ?? "").slice(0, 300), p_via: "panel" })

    if (error) {
        if (error.code === "P0001" || error.code === "P0002") return { ok: false, error: error.message }
        console.error("revisarPedidoAction:", error.message)
        return { ok: false, error: "No se pudo guardar. Inténtalo de nuevo." }
    }

    // Aprobado: el cliente va a abrir sus accesos; que la caché de licencias ya esté al día.
    if (decision === "aprobar") after(() => precalentarLicencias(supabase))
    revalidatePath("/administrar/pedidos")
    revalidatePath("/administrar/compras")
    revalidatePath("/administrar/tienda")
    revalidatePath("/administrar/perfiles")
    return { ok: true }
}
