import { z } from "zod"
import { validateEmail, validateUsername, validatePhoneValue } from "@lib/validation"
import { splitPhoneNumber } from "@lib/phone"

/**
 * Envuelve un validador de `@lib/validation` como schema de Zod. Las reglas no se
 * reescriben aquí: cliente y servidor ejecutan literalmente la misma función, así
 * que no pueden volver a divergir.
 */
const fromValidator = (validate: (value: string) => string | null) =>
    z
        .string()
        .trim()
        .superRefine((value, ctx) => {
            const error = validate(value)
            if (error) ctx.addIssue({ code: "custom", message: error })
        })

/** Campos que comparten crear y editar un cliente. */
export const customerBaseSchema = z.object({
    username: fromValidator(validateUsername),
    email: fromValidator(validateEmail),
    phone: fromValidator(validatePhoneValue),
})

/** Al crear se suman las credenciales y el rol, que la tabla no pide al usuario. */
export const createCustomerSchema = customerBaseSchema.extend({
    password: z
        .string({ message: "Ingresa una contraseña." })
        .min(6, { message: "La contraseña debe tener al menos 6 caracteres." }),

    rol: z
        .enum(["user", "admin", "manager"], { message: "Selecciona un rol válido." })
        .optional()
        .default("user"),
})

/** La tabla muestra un único mensaje por intento, así que colapsamos el error. */
export function firstErrorOf<T>(error: z.ZodError<T>): string {
    const fieldErrors = z.flattenError(error).fieldErrors
    const firstError = Object.values(fieldErrors).flat()[0] as string | undefined
    return firstError || "Datos de cliente no válidos."
}

/** Formato con el que se guarda el teléfono: "+57 3001234567". Vacío si no hay número. */
export function normalizePhone(input: string | null | undefined): string {
    const { code, number } = splitPhoneNumber(input)
    return number ? `${code} ${number}` : ""
}
