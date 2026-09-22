"use server"

import type { AccessType, SimpleAccessType } from "@lib/access-type"

export interface ProductoComboItem {
    platform_id: number
    platform_nombre: string
    access_type: SimpleAccessType
    cantidad: number
}

export interface ProductoRow {
    id: number
    platform_id: number | null
    /** Lo que identifica al producto en pantalla: la plataforma si es simple, el nombre propio si es combo. */
    titulo: string
    /** La categoría de la plataforma; un combo cruza varias, así que muestra "Combo". */
    categoria: string
    access_type: AccessType
    costo: number | null
    precio_venta: number | null
    exist: boolean
    /** Vacío en los productos simples; en un combo, qué lleva adentro. */
    combo_items: ProductoComboItem[]
}

type ComboItemEmbed = {
    platform_id: number
    access_type: SimpleAccessType
    cantidad: number
    platform: { nombre: string } | null
}

export async function getAllProductosAction(): Promise<ProductoRow[] | null> {
    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    try {
        const { data, error } = await supabase
            .schema("business")
            .from("producto")
            .select("id,platform_id,nombre,access_type,costo,precio_venta,exist,platform:platform_id(nombre,categoria:category_id(nombre)),producto_combo_item(platform_id,access_type,cantidad,platform:platform_id(nombre))")
            .eq("exist", true)
            .order("platform_id", { ascending: true })
            .order("access_type", { ascending: true })

        if (error) return null

        return data.map((row) => {
            const platform = row.platform as unknown as { nombre: string; categoria: { nombre: string } | null } | null
            const items = ((row.producto_combo_item as unknown as ComboItemEmbed[] | null) ?? []).map((item) => ({
                platform_id: item.platform_id,
                platform_nombre: item.platform?.nombre ?? "--",
                access_type: item.access_type,
                cantidad: item.cantidad,
            }))
            const esCombo = row.access_type === "combo"
            return {
                id: row.id,
                platform_id: row.platform_id,
                titulo: (esCombo ? row.nombre : platform?.nombre) ?? "--",
                categoria: esCombo ? "Combo" : platform?.categoria?.nombre ?? "--",
                access_type: row.access_type,
                costo: row.costo,
                precio_venta: row.precio_venta,
                exist: row.exist,
                combo_items: items.sort((a, b) => a.platform_nombre.localeCompare(b.platform_nombre)),
            }
        })
    } catch {
        return []
    }
}
