"use server"

import type { EstadoPedido } from "@lib/pedido"

export interface PedidoItem {
    profile_id: number
    platform_nombre: string
    perfil_nombre: string
    access_type: string
    precio: number
}

export interface MiPedido {
    id: number
    estado: EstadoPedido
    total: number
    motivo_rechazo: string | null
    created_at: string
    revisado_at: string | null
    items: PedidoItem[]
}

/** Pedidos del cliente que llama, más nuevos primero (la RLS solo deja ver los propios). null = error al leer. */
export async function getMisPedidosAction(): Promise<MiPedido[] | null> {
    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
        .schema("business")
        .from("pedido")
        .select("id,estado,total,motivo_rechazo,created_at,revisado_at,pedido_item(profile_id,platform_nombre,perfil_nombre,access_type,precio)")
        .eq("cliente_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100)

    if (error) {
        console.error("getMisPedidosAction:", error.message)
        return null
    }
    return data.map(({ pedido_item, ...p }) => ({
        ...p,
        total: Number(p.total),
        items: (pedido_item ?? []).map((i) => ({ ...i, precio: Number(i.precio) })),
    }))
}
