// Reglas compartidas (cliente y servidor) de los pedidos pagados por Bre-B. Las mismas que aplica la base
// (business.crear_pedido y el bucket 'comprobantes'): acá solo se adelantan para dar el error sin ir al servidor.

export type EstadoPedido = "pendiente" | "aprobado" | "rechazado"

export const ESTADO_PEDIDO: Record<EstadoPedido, { label: string; clase: string }> = {
    pendiente: { label: "Por verificar", clase: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
    aprobado: { label: "Aprobado", clase: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
    rechazado: { label: "Rechazado", clase: "border-red-500/30 bg-red-500/10 text-red-300" },
}

/** Mismo límite y tipos que el bucket 'comprobantes'. */
export const COMPROBANTE_MAX_BYTES = 5 * 1024 * 1024
export const COMPROBANTE_TIPOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const
export const COMPROBANTE_ACCEPT = COMPROBANTE_TIPOS.join(",")
/** Máximo de perfiles por pedido (business.crear_pedido). */
export const MAX_PERFILES_PEDIDO = 20

const EXTENSION: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" }

/** Error del archivo del comprobante, o null si sirve. */
export function validateComprobante(file: File | null | undefined): string | null {
    if (!file) return "Sube la captura o el PDF del comprobante de pago."
    if (!(COMPROBANTE_TIPOS as readonly string[]).includes(file.type)) return "El comprobante debe ser una imagen (JPG, PNG o WEBP) o un PDF."
    if (file.size > COMPROBANTE_MAX_BYTES) return "El comprobante pesa más de 5 MB."
    if (file.size === 0) return "El archivo del comprobante está vacío."
    return null
}

/** Ruta del comprobante en el bucket: la carpeta es el usuario (la RLS de storage solo deja subir a la propia). */
export function rutaComprobante(userId: string, file: File): string {
    return `${userId}/${Date.now()}-${crypto.randomUUID()}.${EXTENSION[file.type] ?? "bin"}`
}

/**
 * Una llave Bre-B puede ser celular, cédula, correo o alfanumérica (@...). No se valida el tipo: solo que no esté
 * vacía, sea corta y no traiga espacios ni caracteres raros, para que el cliente la copie tal cual.
 */
export function validateLlaveBreb(llave: string): string | null {
    const valor = llave.trim()
    if (!valor) return "Ingresa la llave Bre-B."
    if (valor.length > 60) return "La llave es muy larga."
    if (!/^[\p{L}\p{N}@._+-]+$/u.test(valor)) return "La llave no debe tener espacios ni caracteres especiales."
    return null
}
