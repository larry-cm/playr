"use server"

export interface ProductoRow {
    id: number
    platform_id: number
    platform_nombre: string
    categoria: string
    access_type: "completa" | "pantalla" | "otro"
    costo: number | null
    precio_venta: number | null
    exist: boolean
}

export async function getAllProductosAction(): Promise<ProductoRow[] | null> {
    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    try {
        const { data, error } = await supabase
            .schema("business")
            .from("producto")
            .select("id,platform_id,access_type,costo,precio_venta,exist,platform:platform_id(nombre,categoria:category_id(nombre))")
            .eq("exist", true)
            .order("platform_id", { ascending: true })
            .order("access_type", { ascending: true })

        if (error) return null

        return data.map((row) => {
            const platform = row.platform as unknown as { nombre: string; categoria: { nombre: string } | null } | null
            return {
                id: row.id,
                platform_id: row.platform_id,
                platform_nombre: platform?.nombre ?? "--",
                categoria: platform?.categoria?.nombre ?? "--",
                access_type: row.access_type,
                costo: row.costo,
                precio_venta: row.precio_venta,
                exist: row.exist,
            }
        })
    } catch {
        return []
    }
}
