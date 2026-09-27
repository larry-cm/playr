// Adaptador de Supabase para Bodega: implementa BodegaDb (lo que necesita el orquestador) y las lecturas de la UI. Las escrituras de
// compras SOLO pasan por las funciones SQL de la migracion 20260920190001 (iniciar_compra, actualizar_compra): la base es quien
// garantiza idempotencia y candado global.

import type { SupabaseClient } from "@supabase/supabase-js"
import { esCombo } from "@lib/bodega/entrega"
import type { BodegaDb, CompraRow, ListingRow } from "@lib/bodega/compra"
import type { AccessType, BodegaCatalogo, BodegaProducto, EstadoCompra } from "@lib/bodega/tipos"

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))

function aCompra(r: Record<string, unknown>): CompraRow {
    return {
        id: Number(r.id),
        request_id: String(r.request_id),
        listing_id: Number(r.listing_id),
        cantidad: Number(r.cantidad),
        precio_unitario: Number(r.precio_unitario),
        total: Number(r.total),
        estado: r.estado as EstadoCompra,
        pedido_proveedor: num(r.pedido_proveedor),
        saldo_antes: num(r.saldo_antes),
        saldo_despues: num(r.saldo_despues),
        detalle: (r.detalle as string | null) ?? null,
        created_at: String(r.created_at),
    }
}

export function bodegaDb(supabase: SupabaseClient): BodegaDb {
    const biz = () => supabase.schema("business")
    return {
        async listing(id): Promise<ListingRow | null> {
            const { data, error } = await biz().from("market_listing").select("id,nombre_raw,platform_id,access_type").eq("id", id).maybeSingle()
            if (error || !data) return null
            return { id: data.id, nombre: data.nombre_raw, platformId: data.platform_id, accessType: data.access_type as AccessType }
        },

        async iniciarCompra(a) {
            const { data, error } = await biz().rpc("iniciar_compra", {
                p_request_id: a.requestId, p_listing_id: a.listingId, p_cantidad: a.cantidad, p_precio_unitario: a.precioUnitario, p_saldo: a.saldo,
            })
            if (error) return { error: error.message === "compra_en_curso" ? ("en_curso" as const) : error.message }
            return { nueva: Boolean(data.nueva), compra: aCompra(data.compra) }
        },

        async actualizarCompra(id, a) {
            const { error } = await biz().rpc("actualizar_compra", {
                p_id: id, p_estado: a.estado, p_pedido: a.pedido ?? null, p_saldo_despues: a.saldoDespues ?? null, p_detalle: a.detalle ?? null,
            })
            return error ? error.message : null
        },
    }
}

// ---- lecturas para la UI -------------------------------------------------------------------------------------------

/**
 * Productos del proveedor que NO estaban agotados en el ULTIMO escaneo del cron (extraction_run mas reciente del proveedor).
 * Un producto que el sitio retiro no tiene snapshot en esa corrida, asi que no aparece aunque estuviera disponible antes.
 */
export async function leerCatalogoBodega(supabase: SupabaseClient, host: string): Promise<BodegaCatalogo | null> {
    const biz = supabase.schema("business")
    const { data: prov, error: e1 } = await biz.from("provider").select("id").eq("nombre", host).maybeSingle()
    if (e1) return null
    if (!prov) return { productos: [], escaneo: null, escaneoEn: null }

    const { data: run, error: e2 } = await biz
        .from("extraction_run")
        .select("id,fecha_extraccion,created_at")
        .eq("provider_id", prov.id)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle()
    if (e2) return null
    if (!run) return { productos: [], escaneo: null, escaneoEn: null }

    const { data, error } = await biz
        .from("market_listing_snapshot")
        .select("precio,listing:listing_id(id,nombre_raw,access_type,platform_id,platform:platform_id(nombre))")
        .eq("run_id", run.id)
        .eq("disponible", true)
    if (error) return null

    type Fila = { precio: number; listing: { id: number; nombre_raw: string; access_type: AccessType; platform_id: number | null; platform: { nombre: string } | null } | null }
    const productos: BodegaProducto[] = (data as unknown as Fila[]).flatMap((f) =>
        f.listing
            ? [{
                listing_id: f.listing.id,
                nombre: f.listing.nombre_raw.replace(/^z\s+(?=COMBO\b)/i, ""),
                platform_id: f.listing.platform_id,
                platform_nombre: f.listing.platform?.nombre ?? null,
                access_type: f.listing.access_type,
                precio: Number(f.precio),
                combo: f.listing.platform_id === null && esCombo(f.listing.nombre_raw),
            }]
            : [],
    )
    // por plataforma (los combos y sin plataforma al final), luego tipo de acceso y precio
    const orden = { completa: 0, pantalla: 1, otro: 2 }
    productos.sort((a, b) =>
        Number(a.platform_nombre === null) - Number(b.platform_nombre === null) ||
        (a.platform_nombre ?? "").localeCompare(b.platform_nombre ?? "") ||
        orden[a.access_type] - orden[b.access_type] || a.precio - b.precio || a.nombre.localeCompare(b.nombre),
    )
    // created_at es NULL en las corridas anteriores a la migración 20260927210001: de esas solo se conoce la fecha
    return { productos, escaneo: run.fecha_extraccion, escaneoEn: run.created_at ?? null }
}
