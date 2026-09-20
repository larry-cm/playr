"use server"

import { createProductoSchema, firstErrorOfProducto } from "@lib/producto-schema"
import type { ProductoRow } from "@action/manager-and-admin/productos/get-all-productos-action"

export async function createProductoAction(formData: {
    platform_id: number | string
    access_type: string
    precio_venta: number | string
}): Promise<{ producto: ProductoRow } | string> {
    const data = createProductoSchema.safeParse(formData)
    if (!data.success) return firstErrorOfProducto(data.error)

    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()

    // Solo se puede crear un producto de algo que ya tengo comprado: nunca confiar
    // en que el cliente solo mandó opciones del selector filtrado.
    const { data: cuentaPropia, error: cuentaError } = await supabase
        .schema("business")
        .from("account")
        .select("id")
        .eq("platform_id", data.data.platform_id)
        .eq("access_type", data.data.access_type)
        .eq("exist", true)
        .limit(1)
        .maybeSingle()

    if (cuentaError) return "Error al verificar tu inventario."
    if (!cuentaPropia) return "No tenés ninguna licencia comprada de este producto todavía."

    // El costo nunca lo manda el cliente: se busca en el servidor y de paso confirma
    // que el proveedor todavía lo vende (si no aparece, no se crea).
    const { data: oferta, error: ofertaError } = await supabase
        .schema("business")
        .from("oferta_proveedor")
        .select("costo")
        .eq("platform_id", data.data.platform_id)
        .eq("access_type", data.data.access_type)
        .maybeSingle()

    if (ofertaError) return "Error al verificar el catálogo del proveedor."
    if (!oferta) return "Este producto no está disponible en el catálogo de tu proveedor."

    const { data: created, error } = await supabase
        .schema("business")
        .from("producto")
        .insert({
            platform_id: data.data.platform_id,
            access_type: data.data.access_type,
            costo: oferta.costo,
            precio_venta: data.data.precio_venta,
        })
        .select("id,platform_id,access_type,costo,precio_venta,exist,platform:platform_id(nombre,categoria:category_id(nombre))")
        .single()

    if (error) {
        // unique(platform_id, access_type)
        if (error.code === "23505") return "Ya existe un producto con esa plataforma y tipo de acceso."
        return "Error al crear el producto."
    }

    const platform = created.platform as unknown as { nombre: string; categoria: { nombre: string } | null } | null

    return {
        producto: {
            id: created.id,
            platform_id: created.platform_id,
            platform_nombre: platform?.nombre ?? "--",
            categoria: platform?.categoria?.nombre ?? "--",
            access_type: created.access_type,
            costo: created.costo,
            precio_venta: created.precio_venta,
            exist: created.exist,
        },
    }
}
