import { z } from "zod"

/**
 * Un perfil (business.profile) es la pantalla individual que se vende: siempre pertenece a una
 * cuenta ya comprada, así que este módulo no crea perfiles, solo edita los que llegaron con una
 * compra. El estado es lo que decide si el perfil aparece en la Tienda (catalogo_disponible solo
 * muestra 'disponible').
 */
export const editPerfilSchema = z.object({
    nombre_perfil: z.string().trim().min(1, "Ingresa el nombre del perfil.").max(60, "El nombre admite hasta 60 caracteres."),
    pin: z
        .string()
        .trim()
        .max(20, "El PIN admite hasta 20 caracteres.")
        .optional()
        .transform((value) => (value === undefined || value === "" ? null : value)),
    estado: z.enum(["disponible", "vendido", "suspendido", "en_soporte"], { message: "Selecciona un estado válido." }),
})

/** Mismo patrón que customer-schema/producto-schema: un único mensaje por intento. */
export function firstErrorOfPerfil<T>(error: z.ZodError<T>): string {
    const fieldErrors = z.flattenError(error).fieldErrors
    const firstError = Object.values(fieldErrors).flat()[0] as string | undefined
    return firstError || "Datos de perfil no válidos."
}
