/** "AMAZON PRIME PANTALLA 1 MES" -> "Amazon prime pantalla 1 mes". Solo para mostrar: el proveedor escribe todo en mayúsculas. */
export const capitalizar = (texto: string) => {
    const t = texto.trim().toLocaleLowerCase("es")
    return t.charAt(0).toLocaleUpperCase("es") + t.slice(1)
}
