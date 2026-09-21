"use server"

import { getRoleUser } from "@action/get-role-action"
import { leerCatalogoBodega } from "@lib/bodega/db"
import type { BodegaCatalogo } from "@lib/bodega/tipos"

/** Productos del proveedor en stock según el último escaneo del cron. Solo admin/manager. null = error o sin permiso. */
export async function getBodegaCatalogoAction(): Promise<BodegaCatalogo | null> {
    const role = await getRoleUser()
    if (role !== "admin" && role !== "manager") return null

    const base = process.env.PLATFORM_URL
    if (!base) return null

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    try {
        // business.provider.nombre es el host del sitio (igual que en la Edge Function stock-price-watch)
        return await leerCatalogoBodega(supabase, new URL(base).hostname)
    } catch {
        return null
    }
}
