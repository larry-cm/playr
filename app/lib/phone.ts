import { countries } from "@lib/countries"

// Agrupa los dígitos nacionales de forma legible según su longitud.
function groupDigits(digits: string): string {
    switch (digits.length) {
        case 8:
            return `${digits.slice(0, 4)} ${digits.slice(4)}`
        case 9:
            return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
        case 10:
            return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
        case 11:
            return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`
        default:
            return digits
    }
}

// Los códigos más largos se prueban primero para que "+1-809" gane sobre "+1".
const codesByLength = [...countries]
    .map((country) => ({ ...country, prefix: country.code.replace(/\D/g, "") }))
    .sort((a, b) => b.prefix.length - a.prefix.length)

/**
 * Formatea un teléfono de cualquiera de los países soportados en la creación
 * de clientes. Nunca falla: si no reconoce el indicativo devuelve el valor
 * recibido tal cual, para no ocultar el registro en el listado.
 */
export function formatPhoneNumber(input: string | null | undefined): string {
    const raw = String(input ?? "").trim()
    const digits = raw.replace(/\D/g, "")

    if (!digits.length) return "--"

    for (const country of codesByLength) {
        if (!digits.startsWith(country.prefix)) continue

        const national = digits.slice(country.prefix.length)
        if (national.length < country.minDigits || national.length > country.maxDigits) continue

        return `${country.code} ${groupDigits(national)}`
    }

    // Sin indicativo reconocible: si parece un celular colombiano lo asumimos como tal.
    if (digits.length === 10 && digits.startsWith("3")) {
        return `+57 ${groupDigits(digits)}`
    }

    return raw
}
