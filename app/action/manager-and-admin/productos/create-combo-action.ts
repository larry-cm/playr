"use server"

import { revalidatePath } from "next/cache"
import { createComboSchema, firstErrorOfProducto } from "@lib/producto-schema"
import type { ProductoRow } from "@action/manager-and-admin/productos/get-all-productos-action"

interface ComboItemInput {
    platform_id: number | string
    access_type: string
    cantidad: number | string
}

const ofertaKey = (p: { platform_id: number; access_type: string }) => `${p.platform_id}:${p.access_type}`

/**
 * Crea un producto tipo combo: agrupa pantallas/cuentas de VARIAS plataformas bajo un nombre y un
 * precio propios (ver migración 20260920200001_producto_combo.sql). No sale de una licencia
 * comprada como el producto simple — un combo es una forma de vender, y el stock de cada plataforma
 * que lo compone se compra por separado.
 *
 * El costo NO lo tipea el manager: se calcula sumando cantidad × costo de cada ítem según lo que el
 * proveedor vende hoy (business.oferta_proveedor), igual que en createProductoAction. Eso también
 * sirve de validación del lado del servidor: si un ítem no está en la oferta, no se crea el combo.
 */
export async function createComboAction(formData: {
    nombre: string
    precio_venta: number | string
    items: ComboItemInput[]
}): Promise<{ producto: ProductoRow } | string> {
    const data = createComboSchema.safeParse(formData)
    if (!data.success) return firstErrorOfProducto(data.error)

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()

    const { data: oferta, error: ofertaError } = await supabase
        .schema("business")
        .from("oferta_proveedor")
        .select("platform_id,platform_nombre,access_type,costo")
    if (ofertaError) return "Error al verificar la oferta del proveedor."

    const ofertaByKey = new Map((oferta ?? []).map((o) => [ofertaKey(o), o]))

    let costo = 0
    for (const item of data.data.items) {
        const encontrada = ofertaByKey.get(ofertaKey(item))
        if (!encontrada) return "Alguna de las opciones elegidas ya no la vende el proveedor. Volvé a armar el combo."
        // El costo de un ítem puede no conocerse todavía; el del combo queda incompleto, no en cero.
        if (encontrada.costo === null) {
            costo = Number.NaN
            break
        }
        costo += Number(encontrada.costo) * item.cantidad
    }

    const { data: created, error } = await supabase
        .schema("business")
        .from("producto")
        .insert({
            platform_id: null,
            access_type: "combo",
            nombre: data.data.nombre,
            costo: Number.isFinite(costo) ? costo : null,
            precio_venta: data.data.precio_venta,
        })
        .select("id,platform_id,nombre,access_type,costo,precio_venta,exist")
        .single()

    if (error) return "Error al crear el combo."

    const { error: itemsError } = await supabase
        .schema("business")
        .from("producto_combo_item")
        .insert(
            data.data.items.map((item) => ({
                producto_id: created.id,
                platform_id: item.platform_id,
                access_type: item.access_type,
                cantidad: item.cantidad,
            }))
        )

    if (itemsError) {
        // Un combo sin receta no es nada: se borra la cabecera recién creada en vez de dejar una
        // fila a medias. Es un DELETE real y no el soft-delete habitual porque nunca llegó a existir
        // para nadie: no tiene historial que preservar.
        await supabase.schema("business").from("producto").delete().eq("id", created.id)
        return "Error al guardar el contenido del combo."
    }

    revalidatePath("/administrar/productos")

    return {
        producto: {
            id: created.id,
            platform_id: null,
            titulo: created.nombre ?? "--",
            categoria: "Combo",
            access_type: "combo",
            costo: created.costo,
            precio_venta: created.precio_venta,
            exist: created.exist,
            combo_items: data.data.items.map((item) => ({
                platform_id: item.platform_id,
                platform_nombre: ofertaByKey.get(ofertaKey(item))?.platform_nombre ?? "--",
                access_type: item.access_type,
                cantidad: item.cantidad,
            })),
        },
    }
}
