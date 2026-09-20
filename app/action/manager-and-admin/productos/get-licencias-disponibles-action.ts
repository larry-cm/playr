"use server"

export interface LicenciaDisponible {
    platform_id: number
    platform_nombre: string
    access_type: "completa" | "pantalla" | "otro"
    costo: number
}

/**
 * Combos plataforma+tipo_acceso que YA tengo comprados (business.account con exist=true)
 * y que todavía no tienen un producto creado. Es la única fuente permitida para crear un
 * producto nuevo: no tiene sentido configurar precio de venta de algo que no tengo en stock.
 * El costo se toma de oferta_proveedor (último precio visto en el scrape del proveedor).
 */
export async function getLicenciasDisponiblesAction(): Promise<LicenciaDisponible[] | null> {
    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    try {
        const [cuentasRes, ofertaRes, productoRes] = await Promise.all([
            supabase
                .schema("business")
                .from("account")
                .select("platform_id,access_type")
                .eq("exist", true),
            supabase
                .schema("business")
                .from("oferta_proveedor")
                .select("platform_id,platform_nombre,access_type,costo")
                .order("platform_nombre", { ascending: true }),
            supabase
                .schema("business")
                .from("producto")
                .select("platform_id,access_type")
                .eq("exist", true),
        ])

        if (cuentasRes.error || ofertaRes.error || productoRes.error) return null

        const comboKey = (p: { platform_id: number; access_type: string }) => `${p.platform_id}:${p.access_type}`
        const propias = new Set(cuentasRes.data.map(comboKey))
        const taken = new Set(productoRes.data.map(comboKey))

        return ofertaRes.data.filter((o) => propias.has(comboKey(o)) && !taken.has(comboKey(o)))
    } catch {
        return []
    }
}
