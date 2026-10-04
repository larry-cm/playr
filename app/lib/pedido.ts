// Reglas compartidas (cliente y servidor) de los pedidos pagados por Bre-B. Las mismas que aplica la base
// (business.crear_pedido y el bucket 'comprobantes'): acá solo se adelantan para dar el error sin ir al servidor.

export type EstadoPedido = "pendiente" | "aprobado" | "rechazado"

export const ESTADO_PEDIDO: Record<EstadoPedido, { label: string; clase: string }> = {
    pendiente: { label: "Por verificar", clase: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
    aprobado: { label: "Aprobado", clase: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
    rechazado: { label: "Rechazado", clase: "border-red-500/30 bg-red-500/10 text-red-300" },
}

/** Mismo límite y tipos que el bucket 'comprobantes': lo que comparten las apps de bancos (captura, foto o PDF). */
export const COMPROBANTE_MAX_BYTES = 5 * 1024 * 1024
const EXTENSION: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/gif": "gif",
    "application/pdf": "pdf",
}
export const COMPROBANTE_TIPOS = Object.keys(EXTENSION)
/** "image/*" hace que el celular ofrezca la galería; las extensiones cubren HEIC donde el navegador no le pone tipo. */
export const COMPROBANTE_ACCEPT = ["image/*", ...COMPROBANTE_TIPOS, ".heic", ".heif"].join(",")
/** Máximo de perfiles por pedido (business.crear_pedido; decisión del usuario 2026-10-04: 1 pedido pendiente con hasta 5). */
export const MAX_PERFILES_PEDIDO = 5

const POR_EXTENSION: Record<string, string> = { ...Object.fromEntries(Object.entries(EXTENSION).map(([t, e]) => [e, t])), jpeg: "image/jpeg" }

/**
 * Tipo del comprobante. Algunos navegadores (Chrome en Windows con fotos HEIC de iPhone) entregan el archivo sin tipo:
 * entonces se deduce de la extensión. "" = formato no aceptado.
 */
export function tipoComprobante(file: File): string {
    if (COMPROBANTE_TIPOS.includes(file.type)) return file.type
    if (file.type && file.type !== "application/octet-stream") return ""
    return POR_EXTENSION[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? ""
}

/** Error del archivo del comprobante, o null si sirve. */
export function validateComprobante(file: File | null | undefined): string | null {
    if (!file) return "Sube la captura o el PDF del comprobante de pago."
    if (!tipoComprobante(file)) return "El comprobante debe ser una imagen (JPG, PNG, WEBP, HEIC o GIF) o un PDF."
    if (file.size > COMPROBANTE_MAX_BYTES) return "El comprobante pesa más de 5 MB."
    if (file.size === 0) return "El archivo del comprobante está vacío."
    return null
}

/** Ruta del comprobante en el bucket: la carpeta es el usuario (la RLS de storage solo deja subir a la propia). */
export function rutaComprobante(userId: string, file: File): string {
    return `${userId}/${Date.now()}-${crypto.randomUUID()}.${EXTENSION[tipoComprobante(file)] ?? "bin"}`
}

const RUTA_ARCHIVO = new RegExp(`^\\d{13}-[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\\.(${Object.values(EXTENSION).join("|")})$`)

/** true si la ruta tiene la forma que arma rutaComprobante y está en la carpeta de ese usuario. */
export function esRutaComprobante(userId: string, ruta: unknown): ruta is string {
    if (typeof ruta !== "string") return false
    const partes = ruta.split("/")
    return partes.length === 2 && partes[0] === userId && RUTA_ARCHIVO.test(partes[1])
}

/** El navegador y Telegram (sendPhoto) muestran estas imágenes; HEIC/HEIF y PDF van como archivo para abrir o descargar. */
export const comprobanteEsImagen = (ruta: string) => /\.(jpe?g|png|webp|gif)$/i.test(ruta)

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

/** Nombre con el que el cliente reconoce la llave ("Nequi", "Bancolombia"…). Mismo límite que business.llave_breb. */
export function validateNombreLlave(nombre: string): string | null {
    const valor = nombre.trim()
    if (!valor) return "Ponle un nombre a la llave (por ejemplo, Nequi)."
    if (valor.length > 40) return "El nombre es muy largo (máximo 40 caracteres)."
    return null
}

/** QR de una llave Bre-B (bucket 'llaves-qr'): la imagen que genera la app del banco. */
export const QR_LLAVE_MAX_BYTES = 2 * 1024 * 1024
const QR_EXTENSION: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }
export const QR_LLAVE_ACCEPT = Object.keys(QR_EXTENSION).join(",")

/** Error de la imagen del QR, o null si sirve. */
export function validateQrLlave(file: File): string | null {
    if (!QR_EXTENSION[file.type]) return "El QR debe ser una imagen PNG, JPG o WEBP."
    if (file.size === 0) return "La imagen está vacía."
    if (file.size > QR_LLAVE_MAX_BYTES) return "La imagen del QR pesa más de 2 MB."
    return null
}

/** Ruta del QR: la carpeta es la llave (business.llave_breb exige ese prefijo). */
export const rutaQrLlave = (llaveId: number, file: File) => `${llaveId}/${Date.now()}-${crypto.randomUUID()}.${QR_EXTENSION[file.type] ?? "png"}`
