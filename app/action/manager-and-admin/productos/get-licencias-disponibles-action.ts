"use server"

import { scrapeLicenciasActivas } from "@lib/scrape-licencias"

export interface LicenciaDisponible {
    platform_id: number
    platform_nombre: string
    access_type: "completa" | "pantalla" | "otro"
    costo: number | null
}

const comboKey = (p: { platform_id: number; access_type: string }) => `${p.platform_id}:${p.access_type}`

/**
 * Escanea (fetch, sin navegador) las licencias activas de la cuenta del proveedor en
 * /mi-cuenta/view-license-keys/ y las cruza con lo que ya tiene producto creado, para ofrecer en el
 * selector solo combinaciones plataforma+acceso que: (a) el admin realmente tiene compradas y
 * vigentes hoy, y (b) todavía no tienen producto. El costo de referencia sale de oferta_proveedor
 * (último precio scrapeado del catálogo público) cuando existe.
 */
export async function getLicenciasDisponiblesAction(): Promise<LicenciaDisponible[] | null> {
    const base = process.env.PLATFORM_URL
    const email = process.env.PLATFORM_EMAIL
    const password = process.env.PLATFORM_PASSWORD
    if (!base || !email || !password) return null

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    try {
        const [platformRes, productoRes, ofertaRes] = await Promise.all([
            supabase.schema("business").from("platform").select("id,nombre").eq("exist", true),
            supabase.schema("business").from("producto").select("platform_id,access_type").eq("exist", true),
            supabase.schema("business").from("oferta_proveedor").select("platform_id,access_type,costo"),
        ])
        if (platformRes.error || productoRes.error || ofertaRes.error) return null

        const licencias = await scrapeLicenciasActivas({ base, email, password }, platformRes.data.map((p) => p.nombre))

        const taken = new Set(productoRes.data.map(comboKey))
        const platformIdByNombre = new Map(platformRes.data.map((p) => [p.nombre, p.id]))
        const costoByKey = new Map(ofertaRes.data.map((o) => [comboKey(o), o.costo as number]))

        const combos = new Map<string, LicenciaDisponible>()
        for (const l of licencias) {
            const platform_id = platformIdByNombre.get(l.platformNombre)
            if (!platform_id) continue
            const key = comboKey({ platform_id, access_type: l.access })
            if (taken.has(key) || combos.has(key)) continue
            combos.set(key, { platform_id, platform_nombre: l.platformNombre, access_type: l.access, costo: costoByKey.get(key) ?? null })
        }
        return [...combos.values()].sort((a, b) => a.platform_nombre.localeCompare(b.platform_nombre))
    } catch {
        return null
    }
}
