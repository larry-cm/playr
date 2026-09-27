import { z } from "zod"

/**
 * Una cuenta (business.account) es el login real que se le compró al proveedor y que agrupa los
 * perfiles vendibles de UNA plataforma. Nunca se da de alta a mano desde este módulo: las cuentas
 * nacen de una compra (ver create-producto-action.ts y business.registrar_licencias), así que acá
 * solo se edita lo operativo. Plataforma, correo y contraseña son su identidad y no se tocan; el
 * estado de venta vive en cada perfil (ver perfil-schema.ts), no en la cuenta.
 */

/** El costo es referencial y puede no conocerse todavía, a diferencia del precio_venta de producto. */
const optionalMoney = z
    .union([z.number(), z.string()])
    .optional()
    .transform((value) => (value === undefined || value === "" ? null : typeof value === "number" ? value : Number(value)))
    .refine((value) => value === null || (Number.isFinite(value) && value >= 0), {
        message: "Ingresa un costo válido (0 o mayor).",
    })

/** `date` puro: se guarda tal cual el string ISO para no arrastrar el huso horario del servidor. */
const fechaVencimiento = z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === undefined || value === "" ? null : value))
    .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), {
        message: "Ingresa una fecha de vencimiento válida.",
    })

export const editCuentaSchema = z.object({
    fecha_vencimiento: fechaVencimiento,
    costo: optionalMoney,
    perfil_max: z.coerce
        .number({ message: "Ingresa cuántos perfiles admite la cuenta." })
        .int("Ingresa cuántos perfiles admite la cuenta.")
        .min(1, "La cuenta admite al menos 1 perfil.")
        .max(10, "Máximo 10 perfiles por cuenta."),
})

/** Mismo patrón que customer-schema/producto-schema: un único mensaje por intento. */
export function firstErrorOfCuenta<T>(error: z.ZodError<T>): string {
    const fieldErrors = z.flattenError(error).fieldErrors
    const firstError = Object.values(fieldErrors).flat()[0] as string | undefined
    return firstError || "Datos de cuenta no válidos."
}
