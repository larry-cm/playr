import { z } from "zod"
import { validateEmail } from "@lib/validation"

/**
 * Una cuenta (business.account) es el login real que se le compró al proveedor y que agrupa los
 * perfiles vendibles de UNA plataforma. Nunca se da de alta a mano desde este módulo: las cuentas
 * nacen de una compra (ver create-producto-action.ts y business.registrar_licencias). Lo único que
 * se edita es el correo (p. ej. si el proveedor lo cambia); plataforma, vencimiento, costo y cupo de
 * perfiles vienen de la compra y se muestran solo de lectura. El estado de venta vive en cada perfil.
 */
export const editCuentaSchema = z.object({
    email: z
        .string()
        .trim()
        .toLowerCase()
        .superRefine((value, ctx) => {
            const error = validateEmail(value)
            if (error) ctx.addIssue({ code: "custom", message: error })
        }),
})

/** Mismo patrón que customer-schema/producto-schema: un único mensaje por intento. */
export function firstErrorOfCuenta<T>(error: z.ZodError<T>): string {
    const fieldErrors = z.flattenError(error).fieldErrors
    const firstError = Object.values(fieldErrors).flat()[0] as string | undefined
    return firstError || "Datos de cuenta no válidos."
}
