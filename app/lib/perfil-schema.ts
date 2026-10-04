import { z } from "zod"
import { validateEmail } from "@lib/validation"

/**
 * Un perfil (business.profile) es la pantalla individual que se vende: siempre pertenece a una
 * cuenta ya comprada, así que este módulo no crea perfiles. Se editan su nombre, PIN y estado (el
 * estado decide si aparece en la Tienda: catalogo_disponible solo muestra disponible) y, de su
 * cuenta, el correo y la contraseña, que comparten todos los perfiles de esa cuenta.
 */
export const editPerfilSchema = z.object({
    estado: z.enum(["disponible", "vendido", "suspendido", "en_soporte", "reservado"], { message: "Selecciona un estado válido." }),
    nombre_perfil: z.string().trim().min(1, "Ingresa el nombre del perfil.").max(50, "El nombre del perfil es muy largo."),
    pin: z
        .string()
        .trim()
        .transform((value) => (value === "" ? null : value))
        .refine((value) => value === null || /^\d{3,8}$/.test(value), { message: "El PIN debe tener entre 3 y 8 dígitos." }),
    email: z
        .string()
        .trim()
        .toLowerCase()
        .superRefine((value, ctx) => {
            const error = validateEmail(value)
            if (error) ctx.addIssue({ code: "custom", message: error })
        }),
    /** undefined = no se cambia. */
    password: z.string().trim().min(1, "Ingresa la contraseña.").max(100, "La contraseña es muy larga.").optional(),
})

/** Mismo patrón que customer-schema/producto-schema: un único mensaje por intento. */
export function firstErrorOfPerfil<T>(error: z.ZodError<T>): string {
    const fieldErrors = z.flattenError(error).fieldErrors
    const firstError = Object.values(fieldErrors).flat()[0] as string | undefined
    return firstError || "Datos de perfil no válidos."
}
