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
