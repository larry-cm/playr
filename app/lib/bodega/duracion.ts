/**
 * Duración de un producto del proveedor, leída de su nombre: "SPOTIFY 3 MESES", "DEEZER PREMIUM X1 MES", "FLUJO TV 1 AÑO",
 * "NETFLIX ORIGINAL PANTALLA 33 DIAS RENOVABLE", "FLUJO PANEL 30 CREDITOS". El sitio no la publica en otro lado.
 * Sin duración en el nombre ("HBO PANTALLA") es el mes estándar del proveedor: las cuentas que ya entregó así duraron ~30 días.
 */
export function duracionDe(nombre: string): string {
    // sin tildes y en mayúsculas: "AÑO" -> "ANO", "DÍAS" -> "DIAS"
    const n = nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()

    const creditos = /(\d+)\s*CREDITOS?\b/.exec(n)
    if (creditos) return `${creditos[1]} créditos`

    const m = /(?:^|[\s(X])(\d+)\s*(MESES|MES|ANOS|ANO|DIAS|DIA)\b/.exec(n)
    if (!m) return "1 mes"
    const cant = Number(m[1])
    if (m[2].startsWith("MES")) return cant === 1 ? "1 mes" : `${cant} meses`
    if (m[2].startsWith("ANO")) return cant === 1 ? "1 año" : `${cant} años`
    return cant === 1 ? "1 día" : `${cant} días`
}
