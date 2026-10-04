// Registro de compras guardado en la base (business.historial_proveedor, migracion 20261003120001): una fila por cuenta del
// proveedor. Solo escribe business.historial_fusionar (fusiona por id bajo candado de fila, calcula origen y ordena).

import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { ProveedorCfg } from "@lib/bodega/proveedor"
import type { HistorialProveedor, PedidoProveedor } from "@lib/bodega/tipos"

/** Identidad de la cuenta del proveedor: sha256(host|email). Si cambia la cuenta configurada, tiene su propio registro. */
export function cuentaProveedor(cfg: ProveedorCfg): { cuenta: string; host: string } {
    const host = new URL(cfg.base).hostname
    return { cuenta: createHash("sha256").update(`${host}|${cfg.email.trim().toLowerCase()}`).digest("hex"), host }
}

/** Lo guardado para esa cuenta. Sin fila = nunca se sincronizó (lista vacía, sincronizadoEn null). null = error de lectura. */
export async function leerHistorial(supabase: SupabaseClient, cfg: ProveedorCfg): Promise<HistorialProveedor | null> {
    const { data, error } = await supabase
        .schema("business")
        .from("historial_proveedor")
        .select("pedidos,sincronizado_en")
        .eq("cuenta", cuentaProveedor(cfg).cuenta)
        .maybeSingle()
    if (error) return null
    return { pedidos: (data?.pedidos as PedidoProveedor[] | undefined) ?? [], sincronizadoEn: data?.sincronizado_en ?? null }
}

/**
 * Fusiona pedidos con lo guardado (lo que llega gana; lo que no viene se conserva). `sincronizado` = es la lectura completa del
 * sitio (sella sincronizado_en). Lanza si la base rechaza la fusión.
 */
export async function fusionarHistorial(
    supabase: SupabaseClient,
    cfg: ProveedorCfg,
    pedidos: PedidoProveedor[],
    sincronizado: boolean,
): Promise<HistorialProveedor> {
    const { cuenta, host } = cuentaProveedor(cfg)
    const { data, error } = await supabase.schema("business").rpc("historial_fusionar", {
        p_cuenta: cuenta, p_host: host, p_pedidos: pedidos, p_sincronizado: sincronizado,
    })
    if (error) throw new Error(`historial_fusionar: ${error.message}`)
    return { pedidos: data.pedidos as PedidoProveedor[], sincronizadoEn: data.sincronizado_en ?? null }
}
