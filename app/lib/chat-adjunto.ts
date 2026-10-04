// Reglas compartidas (cliente y servidor) de los adjuntos del chat con el asesor: las mismas del bucket 'chat'
// (migraciones 20261004200001_chat_adjuntos.sql y 20261006100002_pedido_qr_chat.sql). Acá solo se adelantan para dar
// el error sin subir el archivo.

export type TipoAdjunto = "imagen" | "audio" | "documento"
/** De qué bucket es el adjunto: 'chat' (lo subido en la conversación), 'llaves-qr' (QR del mensaje automático, público) o 'comprobantes'. */
export type BucketAdjunto = "chat" | "llaves-qr" | "comprobantes"

export const ADJUNTO_MAX_BYTES = 10 * 1024 * 1024
/** Una nota de voz se corta sola a los 3 minutos. */
export const NOTA_VOZ_MAX_MS = 3 * 60 * 1000

const EXTENSION: Record<string, { ext: string; tipo: TipoAdjunto }> = {
    "image/jpeg": { ext: "jpg", tipo: "imagen" },
    "image/png": { ext: "png", tipo: "imagen" },
    "image/webp": { ext: "webp", tipo: "imagen" },
    "image/gif": { ext: "gif", tipo: "imagen" },
    "audio/webm": { ext: "webm", tipo: "audio" },
    "audio/ogg": { ext: "ogg", tipo: "audio" },
    "audio/mp4": { ext: "m4a", tipo: "audio" },
    "audio/mpeg": { ext: "mp3", tipo: "audio" },
    "audio/aac": { ext: "aac", tipo: "audio" },
    "application/pdf": { ext: "pdf", tipo: "documento" },
}

/** Lo que se adjunta con el botón: las imágenes que muestran el navegador y Telegram, y PDF. */
export const ARCHIVO_ACCEPT = Object.keys(EXTENSION).filter((t) => EXTENSION[t].tipo !== "audio").join(",")

/**
 * Formatos para grabar notas de voz, en orden de preferencia: los que Telegram muestra como nota de voz (OGG/Opus,
 * M4A) y si no, WebM (Chrome y Edge), que llega a Telegram como archivo.
 */
export const GRABACION_TIPOS = ["audio/ogg;codecs=opus", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/webm"]

/** Tipo base sin parámetros ("audio/webm;codecs=opus" → "audio/webm"); "" si no es un formato aceptado. */
export function mimeAdjunto(tipo: string): string {
    const base = tipo.split(";")[0].trim().toLowerCase()
    return base in EXTENSION ? base : ""
}

/** Tipo de adjunto de un formato aceptado; null si no se acepta. */
export function tipoAdjunto(mime: string): TipoAdjunto | null {
    return EXTENSION[mimeAdjunto(mime)]?.tipo ?? null
}

/** Error del adjunto, o null si sirve. */
export function validarAdjunto(archivo: Blob, tipo: TipoAdjunto): string | null {
    if (tipoAdjunto(archivo.type) !== tipo) {
        return tipo === "audio" ? "Tu navegador grabó el audio en un formato que no podemos enviar." : "Adjunta una imagen (JPG, PNG, WEBP o GIF) o un PDF."
    }
    if (archivo.size === 0) return "El archivo está vacío."
    if (archivo.size > ADJUNTO_MAX_BYTES) return tipo === "audio" ? "La nota de voz es muy larga." : "El archivo pesa más de 10 MB."
    return null
}

/** Ruta en el bucket: siempre en la carpeta del cliente de la conversación. */
export function rutaAdjunto(clienteId: string, mime: string, prefijo = ""): string {
    return `${clienteId}/${prefijo}${Date.now()}-${crypto.randomUUID()}.${EXTENSION[mimeAdjunto(mime)]?.ext ?? "bin"}`
}

const RESUMEN: Record<TipoAdjunto, [icono: string, nombre: string]> = { imagen: ["📷", "Imagen"], audio: ["🎤", "Nota de voz"], documento: ["📄", "Documento"] }

/** Texto para la vista previa de un mensaje (lista de chats). */
export function resumenMensaje(m: { texto: string; adjunto_tipo: TipoAdjunto | null }): string {
    if (!m.adjunto_tipo) return m.texto
    const [icono, nombre] = RESUMEN[m.adjunto_tipo]
    return `${icono} ${m.texto || nombre}`
}

/**
 * Cada consulta trae enlaces firmados nuevos: se conservan los que ya tenía cada mensaje, así la imagen no se vuelve a
 * descargar y una nota de voz que suena no se corta.
 */
export function conservarUrls<T extends { id: number; adjunto_url: string | null }>(previos: T[] | null | undefined, nuevos: T[]): T[] {
    if (!previos?.length) return nuevos
    const urls = new Map(previos.flatMap((m) => (m.adjunto_url ? [[m.id, m.adjunto_url] as const] : [])))
    return nuevos.map((m) => (urls.has(m.id) ? { ...m, adjunto_url: urls.get(m.id)! } : m))
}
