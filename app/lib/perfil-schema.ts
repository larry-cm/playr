import { z } from "zod"

/**
 * Un perfil (business.profile) es la pantalla individual que se vende: siempre pertenece a una
 * cuenta ya comprada, así que este módulo no crea perfiles. Nombre y PIN vienen del proveedor y no
 * se editan; lo único editable es el estado, que decide si el perfil aparece en la Tienda
 * (catalogo_disponible solo muestra 'disponible').
 */
export const editPerfilSchema = z.object({
    estado: z.enum(["disponible", "vendido", "suspendido", "en_soporte"], { message: "Selecciona un estado válido." }),
})

/** Mismo patrón que customer-schema/producto-schema: un único mensaje por intento. */
export function firstErrorOfPerfil<T>(error: z.ZodError<T>): string {
    const fieldErrors = z.flattenError(error).fieldErrors
    const firstError = Object.values(fieldErrors).flat()[0] as string | undefined
    return firstError || "Datos de perfil no válidos."
}
