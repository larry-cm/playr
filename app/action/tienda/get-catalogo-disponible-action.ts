"use server"

export interface CatalogoDisponibleItem {
    profile_id: number
    perfil_nombre: string
    precio_venta: number
    platform_nombre: string
    categoria: string
}

export async function getCatalogoDisponibleAction(): Promise<CatalogoDisponibleItem[] | null> {
    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    try {
        const { data, error } = await supabase
            .schema("business")
            .from("catalogo_disponible")
            .select("profile_id,perfil_nombre,precio_venta,platform_nombre,categoria")
            .order("platform_nombre", { ascending: true })
            .order("perfil_nombre", { ascending: true })

        if (error) return null
        return data
    } catch {
        return []
    }
}
