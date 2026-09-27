/**
 * Para columnas `date` puras (sin hora), como account.fecha_vencimiento.
 * formatColombianDate no sirve acá: new Date("2026-10-21") se lee como medianoche UTC y, al
 * formatear en America/Bogota (UTC-5), muestra el día anterior. Reformatear el string ISO directo
 * evita ese corrimiento.
 */
export function formatDateOnly(value: string | null | undefined): string {
    const match = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null
    if (!match) return "--"
    const [, year, month, day] = match
    return `${day}/${month}/${year}`
}

export function formatColombianDate(dateString: string): string {
    const date = new Date(dateString)
    const options: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }
    try {
        if (isNaN(date.getTime())) {
            throw new Error("Invalid date")
        }
        return date.toLocaleDateString("es-CO", options)
    } catch (error) {
        console.error("Error al formatear la fecha:", error)
        return "error"
    }
}
