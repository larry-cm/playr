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

/** Mismo patrón que customer-schema: un único mensaje por intento. */
export function firstErrorOfProducto<T>(error: z.ZodError<T>): string {
    const fieldErrors = z.flattenError(error).fieldErrors
    const firstError = Object.values(fieldErrors).flat()[0] as string | undefined
    return firstError || "Datos de producto no válidos."
}
