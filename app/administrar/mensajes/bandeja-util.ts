// Reglas puras de la bandeja (sin React): nombre, orden, filtros y hora corta de la lista.
import { quitarTildes } from "@lib/text"
import type { ClienteChat, Conversacion } from "@action/manager-and-admin/mensajes/mensajes-action"

export const nombreDe = (c: ClienteChat | null | undefined) => c?.username || c?.email || "Cliente"

/** Inicial para el avatar ("?" si el nombre no empieza con letra o número). */
export function inicialDe(nombre: string): string {
    const primera = [...nombre.trim()][0] ?? ""
    return /[\p{L}\p{N}]/u.test(primera) ? primera.toUpperCase() : "?"
}

/** Tiene algo sin leer: mensajes del cliente sin abrir o la marca "no leído" puesta a mano. */
export const tieneNoLeido = (c: Conversacion) => c.sinLeer > 0 || c.noLeidoManual

/** Pestaña de la lista: todos, no leídos o el id de una carpeta. */
export type Pestana = "todos" | "no-leidos" | number

/** Fijados arriba (el último fijado primero, como Telegram); después, el último mensaje más reciente primero. */
export function ordenarConversaciones(cs: Conversacion[]): Conversacion[] {
    return [...cs].sort((a, b) => {
        if (a.fijadoEn && b.fijadoEn) return b.fijadoEn.localeCompare(a.fijadoEn)
        if (a.fijadoEn) return -1
        if (b.fijadoEn) return 1
        return b.ultimo.id - a.ultimo.id
    })
}

/** ¿El chat entra en la pestaña? Los archivados nunca están en las pestañas (tienen su propia vista). */
export function enPestana(c: Conversacion, pestana: Pestana): boolean {
    if (c.archivadoEn) return false
    if (pestana === "todos") return true
    if (pestana === "no-leidos") return tieneNoLeido(c)
    return c.carpetas.includes(pestana)
}

export const textoBusqueda = (c: Conversacion) => quitarTildes(`${c.cliente?.username ?? ""} ${c.cliente?.email ?? ""} ${c.cliente?.phone ?? ""}`)

interface Filtro {
    pestana: Pestana
    archivados: boolean
    /** Etiquetas elegidas: el chat tiene al menos una (como el filtro de WhatsApp Business). */
    etiquetas: number[]
    busqueda: string
    /** El chat abierto sigue en "No leídos" aunque ya se haya leído (no desaparece mientras se lee). */
    abierto: string | null
}

export function filtrarConversaciones(cs: Conversacion[], f: Filtro): Conversacion[] {
    const q = quitarTildes(f.busqueda.trim())
    return cs.filter(
        (c) =>
            (f.archivados ? Boolean(c.archivadoEn) : enPestana(c, f.pestana) || (f.pestana === "no-leidos" && c.cliente_id === f.abierto && !c.archivadoEn)) &&
            (f.etiquetas.length === 0 || c.etiquetas.some((e) => f.etiquetas.includes(e))) &&
            (!q || textoBusqueda(c).includes(q)),
    )
}

const ZONA = "America/Bogota"
const diaDe = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(d)

/** Hora de la lista, en hora de Colombia: hoy "14:05", ayer "Ayer", esta semana "lun", este año "03/10", antes "03/10/25". */
export function horaCorta(iso: string, ahora = new Date()): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    const dia = diaDe(d)
    if (dia === diaDe(ahora)) return new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d)
    const dias = Math.round((Date.parse(diaDe(ahora)) - Date.parse(dia)) / 86_400_000)
    if (dias === 1) return "Ayer"
    if (dias > 1 && dias < 7) return new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, weekday: "short" }).format(d).replace(".", "")
    const mismoAno = dia.slice(0, 4) === diaDe(ahora).slice(0, 4)
    return new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, day: "2-digit", month: "2-digit", ...(mismoAno ? {} : { year: "2-digit" }) }).format(d)
}
