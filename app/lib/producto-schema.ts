import { z } from "zod"

/**
 * precio_venta es obligatorio: sin él el producto no puede aparecer en la Tienda,
 * así que ni crear ni editar lo dejan vacío. El costo nunca se tipea a mano — sale
 * de business.oferta_proveedor (ver getLicenciasDisponiblesAction / createProductoAction).
 */
const requiredMoney = z
    .union([z.number(), z.string()])
    .transform((value) => (typeof value === "number" ? value : Number(value)))
    .refine((value) => Number.isFinite(value) && value >= 0, {
        message: "Ingresa un precio de venta válido (0 o mayor).",
    })

export const createProductoSchema = z.object({
    platform_id: z.coerce.number({ message: "Selecciona un producto del proveedor." }).int().positive("Selecciona un producto del proveedor."),
    access_type: z.enum(["completa", "pantalla", "otro"], { message: "Selecciona un producto del proveedor." }),
    precio_venta: requiredMoney,
})

export const editPrecioVentaSchema = z.object({
    precio_venta: requiredMoney,
})

/**
 * Combo: un producto que agrupa pantallas/cuentas de VARIAS plataformas (ver migración
 * 20260920200001_producto_combo.sql). A diferencia del producto simple no sale de una licencia
 * escaneada del proveedor, así que su receta se arma a mano: qué plataformas lleva y cuántas
 * unidades de cada una. El costo no se tipea — se calcula sumando el de cada ítem.
 */
export const comboItemSchema = z.object({
    platform_id: z.coerce.number({ message: "Selecciona una plataforma." }).int().positive("Selecciona una plataforma."),
    access_type: z.enum(["completa", "pantalla", "otro"], { message: "Selecciona el tipo de acceso de cada plataforma." }),
    cantidad: z.coerce.number({ message: "Ingresa una cantidad válida." }).int().min(1, "La cantidad mínima es 1.").max(20, "La cantidad máxima es 20."),
})

export const createComboSchema = z.object({
    nombre: z.string().trim().min(1, "Ponle un nombre al combo.").max(80, "El nombre admite hasta 80 caracteres."),
    precio_venta: requiredMoney,
    items: z
        .array(comboItemSchema)
        .min(2, "Un combo agrupa al menos dos plataformas distintas.")
        // "de diferentes plataformas": dos pantallas de la misma marca no son un combo, son cantidad 2.
        .refine((items) => new Set(items.map((i) => i.platform_id)).size === items.length, {
            message: "No repitas la misma plataforma: usa la cantidad para pedir más de una.",
        }),
})

/** Mismo patrón que customer-schema: un único mensaje por intento. */
export function firstErrorOfProducto<T>(error: z.ZodError<T>): string {
    const fieldErrors = z.flattenError(error).fieldErrors
    const firstError = Object.values(fieldErrors).flat()[0] as string | undefined
    return firstError || "Datos de producto no válidos."
}
