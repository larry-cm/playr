"use server"

import type { SimpleAccessType } from "@lib/access-type"

export interface OfertaProveedorItem {
    platform_id: number
    platform_nombre: string
    access_type: SimpleAccessType
    costo: number | null
}

/**
 * Qué plataforma+acceso vende el proveedor hoy y a qué costo, según el último escaneo del cron
 * (vista business.oferta_proveedor). Es una query normal a la DB, no un scrapeo: a diferencia de
 * getLicenciasDisponiblesAction responde al instante y no depende del sitio del proveedor.
 *
 * La usa el armado de combos: un combo solo puede llevar cosas que el proveedor realmente ofrece, y
 * su costo se calcula sumando el de cada ítem en vez de tipearlo a mano.
 */
export async function getOfertaProveedorAction(): Promise<OfertaProveedorItem[]> {
    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    try {
        const { data, error } = await supabase
            .schema("business")
            .from("oferta_proveedor")
            .select("platform_id,platform_nombre,access_type,costo")
            .order("platform_nombre", { ascending: true })
            .order("access_type", { ascending: true })

        if (error) return []
        return data as OfertaProveedorItem[]
    } catch {
        return []
    }
}
