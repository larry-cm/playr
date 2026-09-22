/**
 * business.access_type: la forma en que se vende un producto.
 *   completa / pantalla / otro -> producto simple, de UNA plataforma (business.producto.platform_id)
 *   combo                      -> agrupa pantallas o cuentas de VARIAS plataformas; no tiene
 *                                 platform_id y su receta vive en business.producto_combo_item
 * Está centralizado acá para que las etiquetas no se dupliquen entre Productos, Cuentas y Perfiles.
 */
export type AccessType = "completa" | "pantalla" | "otro" | "combo"

/** Lo que puede tener una cuenta real del proveedor: un combo nunca es una cuenta, es un agrupador. */
export type SimpleAccessType = Exclude<AccessType, "combo">

export const accessTypeLabel: Record<AccessType, string> = {
    completa: "Completa",
    pantalla: "Pantalla",
    otro: "Otro",
    combo: "Combo",
}

export const simpleAccessTypes: SimpleAccessType[] = ["pantalla", "completa", "otro"]

export const simpleAccessTypeOptions = simpleAccessTypes.map((value) => ({
    value,
    label: accessTypeLabel[value],
}))
