import { z } from "zod"
import { MAX_CANTIDAD } from "@lib/bodega/tipos"

/** Lo que el cliente manda al comprar. Nada de esto se confia: el servidor re-verifica producto, precio y saldo EN VIVO. */
export const comprarSchema = z.object({
    listing_id: z.coerce.number({ message: "Producto inválido." }).int("Producto inválido.").positive("Producto inválido."),
    cantidad: z.coerce
        .number({ message: "Ingresa una cantidad válida." })
        .int("La cantidad debe ser un número entero.")
        .min(1, "La cantidad mínima es 1.")
        .max(MAX_CANTIDAD, `La cantidad máxima por compra es ${MAX_CANTIDAD}.`),
    precio: z.coerce.number({ message: "Precio inválido." }).min(0, "Precio inválido."),
    request_id: z.uuid({ message: "Solicitud inválida. Recarga la página e inténtalo de nuevo." }),
})

/** Mismo patrón que customer-schema/producto-schema: un único mensaje por intento. */
export function firstErrorOfBodega<T>(error: z.ZodError<T>): string {
    const fieldErrors = z.flattenError(error).fieldErrors
    const firstError = Object.values(fieldErrors).flat()[0] as string | undefined
    return firstError || "Datos de compra no válidos."
}
