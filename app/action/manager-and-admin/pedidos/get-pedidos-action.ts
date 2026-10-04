"use server"

import { esStaff } from "@lib/auth"
import { comprobanteEsImagen } from "@lib/pedido"
import type { MiPedido } from "@action/tienda/get-mis-pedidos-action"

export interface PedidoStaff extends MiPedido {
    llave_breb: string
    /** Nombre de la llave a la que pagó ("Nequi"…); null en pedidos de antes de tener varias llaves. */
    llave_nombre: string | null
    revisado_via: string | null
    cliente: { username: string; email: string | null; phone: string | null } | null
}

/** Últimos 200 pedidos de todos los clientes, más nuevos primero. Solo admin/manager. null = error o sin permiso. */
export async function getPedidosAction(): Promise<PedidoStaff[] | null> {
    if (!(await esStaff())) return null

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    const { data, error } = await supabase
        .schema("business")
        .from("pedido")
        .select("id,cliente_id,estado,total,llave_breb,llave_nombre,motivo_rechazo,revisado_via,created_at,revisado_at,pedido_item(profile_id,platform_nombre,perfil_nombre,access_type,precio)")
        .order("created_at", { ascending: false })
        .limit(200)
    if (error) {
        console.error("getPedidosAction:", error.message)
        return null
    }

    const ids = [...new Set(data.map((p) => p.cliente_id))]
    const { data: clientes } = ids.length
        ? await supabase.schema("security").from("client").select("id,username,email,phone").in("id", ids)
        : { data: [] as { id: string; username: string; email: string | null; phone: string | null }[] }
    const porId = new Map((clientes ?? []).map((c) => [c.id, c]))

    return data.map(({ pedido_item, cliente_id, ...p }) => {
        const c = porId.get(cliente_id)
        return {
            ...p,
            total: Number(p.total),
            items: (pedido_item ?? []).map((i) => ({ ...i, precio: Number(i.precio) })),
            cliente: c ? { username: c.username, email: c.email, phone: c.phone } : null,
        }
    })
}

/** URL firmada (5 min) del comprobante de un pedido. Solo admin/manager. */
export async function getComprobanteUrlAction(pedidoId: number): Promise<{ ok: true; url: string; imagen: boolean } | { ok: false; error: string }> {
    if (!(await esStaff())) return { ok: false, error: "No tienes permiso." }
    if (!Number.isInteger(pedidoId)) return { ok: false, error: "Pedido no encontrado." }

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    const { data: pedido } = await supabase.schema("business").from("pedido").select("comprobante_path").eq("id", pedidoId).maybeSingle()
    if (!pedido) return { ok: false, error: "Pedido no encontrado." }

    const { data, error } = await supabase.storage.from("comprobantes").createSignedUrl(pedido.comprobante_path, 300)
    if (error || !data) return { ok: false, error: "No se pudo abrir el comprobante." }
    return { ok: true, url: data.signedUrl, imagen: comprobanteEsImagen(pedido.comprobante_path) }
}
