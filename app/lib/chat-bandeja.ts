// Reglas compartidas (cliente y servidor) de la bandeja de mensajes: etiquetas, carpetas, estado del chat, reacciones y
// mensajes fijados. Son las mismas de la base (migración 20261005120001_chat_bandeja.sql): los esquemas de Zod dan el
// error antes de llamar a la función, con el mismo texto, y la base vuelve a validar todo.
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { resumenMensaje, type TipoAdjunto } from "@lib/chat-adjunto"

/** Mensaje para quien llama sin sesión (la de la pestaña venció o se cerró). */
export const SIN_SESION = "Tu sesión expiró. Vuelve a iniciar sesión."

export const ETIQUETA_MAX = 20
export const ETIQUETA_NOMBRE_MAX = 30
export const CARPETA_MAX = 10
export const CARPETA_NOMBRE_MAX = 24
export const CARPETA_ICONO_MAX = 8
export const CARPETA_CHATS_MAX = 100
export const CHATS_FIJADOS_MAX = 5
/** Fijar un 4.º mensaje desfija el más viejo. */
export const MENSAJES_FIJADOS_MAX = 3
export const NOTAS_MAX = 1000

/** Evento de ventana: la bandeja cambió algo que mueve el "sin leer" (abrir un chat, marcar no leído…). La insignia del menú lo escucha y vuelve a contar. */
export const EVENTO_SIN_LEER = "playr:chat-sin-leer"

/** Colores de las etiquetas (los únicos que acepta la base, en minúsculas). */
export const COLORES_ETIQUETA = [
    { color: "#3987e5", nombre: "Azul" },
    { color: "#d95926", nombre: "Naranja" },
    { color: "#199e70", nombre: "Esmeralda" },
    { color: "#c98500", nombre: "Ámbar" },
    { color: "#d55181", nombre: "Rosa" },
    { color: "#008300", nombre: "Verde" },
    { color: "#9085e9", nombre: "Lavanda" },
    { color: "#e5484d", nombre: "Rojo" },
    { color: "#0ea5e9", nombre: "Celeste" },
    { color: "#a855f7", nombre: "Morado" },
] as const
export type ColorEtiqueta = (typeof COLORES_ETIQUETA)[number]["color"]

/** Reacciones permitidas (una por persona y mensaje). */
export const REACCIONES = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const
export type Reaccion = (typeof REACCIONES)[number]

// --- Normalización (igual que la base) ---------------------------------------------------------------------------

/** Largo como char_length de Postgres (puntos de código, no unidades UTF-16: un emoji cuenta 1). */
export const largo = (s: string) => [...s].length

/** btrim() de Postgres sin segundo argumento: solo quita espacios (no tabs ni otros blancos). */
const sinEspaciosBorde = (s: string) => s.replace(/^ +| +$/g, "")

/**
 * Nombre de etiqueta/carpeta como lo guarda la base: blancos seguidos (espacio, tab, salto de línea) → un espacio, sin
 * espacios en los bordes. `\s` de Postgres es [[:space:]]; el de JS además incluye espacios Unicode, por eso la clase
 * explícita.
 */
export function normalizarNombre(s: string): string {
    return sinEspaciosBorde(s.replace(/[ \t\n\r\v\f]+/g, " "))
}

/** Icono de carpeta: sin espacios en los bordes; vacío = sin icono. */
export function normalizarIcono(s: string | null | undefined): string | null {
    const v = sinEspaciosBorde(s ?? "")
    return v ? v : null
}

/** Notas internas: sin espacios en los bordes; vacías = sin notas. */
export function normalizarNotas(s: string | null | undefined): string | null {
    const v = sinEspaciosBorde(s ?? "")
    return v ? v : null
}

/** Reacción: sin espacios; "❤" (sin selector de variación) es "❤️"; vacía = quitar. */
export function normalizarReaccion(s: string | null | undefined): string | null {
    const v = sinEspaciosBorde(s ?? "")
    if (!v) return null
    return v === "❤" ? "❤️" : v
}

const esReaccion = (v: string): v is Reaccion => (REACCIONES as readonly string[]).includes(v)
const esColor = (v: string): v is ColorEtiqueta => COLORES_ETIQUETA.some((c) => c.color === v)
const sinRepetidos = (xs: readonly unknown[]) => new Set(xs).size === xs.length

// --- Esquemas ------------------------------------------------------------------------------------------------------

const idDe = (mensaje: string) => z.number({ message: mensaje }).int({ message: mensaje }).positive({ message: mensaje }).max(Number.MAX_SAFE_INTEGER, { message: mensaje })

/** Id de un cliente (uuid de auth.users; z.guid acepta cualquier versión). */
export const clienteIdSchema = z.guid({ message: "Cliente no encontrado." })
export const etiquetaIdSchema = idDe("Etiqueta no encontrada.")
export const carpetaIdSchema = idDe("Carpeta no encontrada.")
export const mensajeIdSchema = idDe("Mensaje no encontrado.")
/** Mensaje al que se responde (null = no es respuesta). */
export const respondeASchema = idDe("El mensaje que respondes no existe.").nullable()

const nombreSchema = (max: number, que: "etiqueta" | "carpeta") =>
    z
        .string({ message: `Escribe el nombre de la ${que}.` })
        .transform(normalizarNombre)
        .superRefine((v, ctx) => {
            if (largo(v) === 0) ctx.addIssue({ code: "custom", message: `Escribe el nombre de la ${que}.` })
            else if (largo(v) > max) ctx.addIssue({ code: "custom", message: `El nombre de la ${que} es muy largo (máximo ${max} caracteres).` })
        })

/** Crear (sin id) o editar una etiqueta. */
export const etiquetaSchema = z.object({
    id: etiquetaIdSchema.nullish().transform((v) => v ?? null),
    nombre: nombreSchema(ETIQUETA_NOMBRE_MAX, "etiqueta"),
    color: z
        .string({ message: "Elige un color de la lista." })
        .transform((v) => sinEspaciosBorde(v).toLowerCase())
        .refine(esColor, { message: "Elige un color de la lista." })
        .transform((v) => v as ColorEtiqueta),
})
export type EtiquetaInput = z.input<typeof etiquetaSchema>

/** Crear (sin id) o editar una carpeta. */
export const carpetaSchema = z.object({
    id: carpetaIdSchema.nullish().transform((v) => v ?? null),
    nombre: nombreSchema(CARPETA_NOMBRE_MAX, "carpeta"),
    icono: z
        .string({ message: "El icono no es válido." })
        .nullish()
        .transform(normalizarIcono)
        .refine((v) => v === null || largo(v) <= CARPETA_ICONO_MAX, { message: "El icono no es válido." }),
})
export type CarpetaInput = z.input<typeof carpetaSchema>

/** Lista de ids sin repetidos (y como mucho `max`). */
const listaDe = <T extends z.ZodType>(item: T, max: number, invalida: string, muchos = invalida) =>
    z
        .array(item, { message: invalida })
        .max(max, { message: muchos })
        .refine(sinRepetidos, { message: invalida })

/** Etiquetas de un chat (el conjunto exacto). */
export const etiquetasIdsSchema = listaDe(etiquetaIdSchema, ETIQUETA_MAX, "La lista de etiquetas no es válida.")
/** Carpetas de un chat (el conjunto exacto). */
export const carpetasIdsSchema = listaDe(carpetaIdSchema, CARPETA_MAX, "La lista de carpetas no es válida.")
/** Nuevo orden de las carpetas: todas, cada una una vez. */
export const ordenCarpetasSchema = listaDe(carpetaIdSchema, CARPETA_MAX, "La lista de carpetas no coincide. Recarga la página.")
/** Chats de una carpeta (el conjunto exacto). */
export const clientesIdsSchema = listaDe(clienteIdSchema, CARPETA_CHATS_MAX, "La lista de chats no es válida.", `Máximo ${CARPETA_CHATS_MAX} chats por carpeta.`)

/** Reacción a poner; null (o la misma que ya tiene) la quita. */
export const reaccionSchema = z
    .string({ message: "Reacción no válida." })
    .nullable()
    .transform(normalizarReaccion)
    .refine((v) => v === null || esReaccion(v), { message: "Reacción no válida." })
    .transform((v) => v as Reaccion | null)

/** Notas internas del chat (vacías = sin notas). */
export const notasSchema = z
    .string({ message: "Las notas no son válidas." })
    .nullable()
    .transform(normalizarNotas)
    .refine((v) => v === null || largo(v) <= NOTAS_MAX, { message: `Las notas son muy largas (máximo ${NOTAS_MAX} caracteres).` })

export const booleanoSchema = z.boolean({ message: "Datos no válidos." })

/** Un solo mensaje por intento: el primero. */
export function firstError(error: z.ZodError, fallback = "Datos no válidos."): string {
    return error.issues[0]?.message || fallback
}

// --- Mensajes: respuestas, reacciones y fijados ----------------------------------------------------------------------

export type AutorChat = "cliente" | "asesor"

/** Vista previa del mensaje respondido o fijado. */
export interface CitaMensaje {
    id: number
    autor: AutorChat
    /** Resumen (con 📷/🎤 si tiene adjunto), recortado. */
    texto: string
    adjunto_tipo: TipoAdjunto | null
}

export interface MensajeFijado extends CitaMensaje {
    fijado_en: string
}

export interface ReaccionMensaje {
    emoji: Reaccion
    autor: AutorChat
    /** La puso quien está mirando. */
    propia: boolean
}

/** Lo que suma cada mensaje del hilo (staff y cliente). */
export interface InteraccionesMensaje {
    responde_a: number | null
    /** Vista previa del respondido; null si no responde o si ya no se puede ver (p. ej. el staff eliminó el chat). */
    cita: CitaMensaje | null
    fijado_en: string | null
    /** Una por persona, la más vieja primero. */
    reacciones: ReaccionMensaje[]
}

/** Primeros `max` caracteres (puntos de código), con "…" si se cortó. */
export function recortar(s: string, max: number): string {
    const cps = [...s]
    return cps.length > max ? `${cps.slice(0, max).join("")}…` : s
}

const CITA_MAX = 120

type FilaCita = { id: number; autor: AutorChat; texto: string; adjunto_tipo: TipoAdjunto | null }

const citaDe = (m: FilaCita): CitaMensaje => ({ id: Number(m.id), autor: m.autor, texto: recortar(resumenMensaje(m), CITA_MAX), adjunto_tipo: m.adjunto_tipo })

type FilaMensaje = FilaCita & { responde_a: number | null; fijado_en: string | null }

/**
 * Solo servidor (con el cliente de Supabase de quien llama: la RLS decide qué ve). Suma a los mensajes de un chat la cita
 * de lo que responden, sus reacciones y los mensajes fijados del chat. `visibleDesde` = el staff solo ve ids mayores
 * (chat eliminado); el cliente, 0. Si una consulta falla, el hilo se muestra igual sin ese dato.
 */
export async function cargarInteracciones<T extends FilaMensaje>(
    supabase: SupabaseClient,
    clienteId: string,
    mensajes: T[],
    { userId, visibleDesde = 0 }: { userId: string | null; visibleDesde?: number },
): Promise<{ mensajes: (T & InteraccionesMensaje)[]; fijados: MensajeFijado[] }> {
    const db = supabase.schema("business")
    const porId = new Map(mensajes.map((m) => [Number(m.id), m]))
    const ids = [...porId.keys()]
    const faltan = [...new Set(mensajes.flatMap((m) => (m.responde_a && !porId.has(Number(m.responde_a)) ? [Number(m.responde_a)] : [])))]
    const vacio = { data: [], error: null }

    const [reacciones, citados, fijados] = await Promise.all([
        ids.length ? db.from("mensaje_reaccion").select("mensaje_id,user_id,autor,emoji").in("mensaje_id", ids).order("created_at") : vacio,
        faltan.length ? db.from("mensaje_asesor").select("id,autor,texto,adjunto_tipo").eq("cliente_id", clienteId).gt("id", visibleDesde).in("id", faltan) : vacio,
        db
            .from("mensaje_asesor")
            .select("id,autor,texto,adjunto_tipo,fijado_en")
            .eq("cliente_id", clienteId)
            .gt("id", visibleDesde)
            .not("fijado_en", "is", null)
            .order("fijado_en", { ascending: false })
            .limit(MENSAJES_FIJADOS_MAX),
    ])
    for (const r of [reacciones, citados, fijados]) if (r.error) console.error("cargarInteracciones:", r.error.message)

    const porMensaje = new Map<number, ReaccionMensaje[]>()
    for (const r of (reacciones.data ?? []) as { mensaje_id: number; user_id: string; autor: AutorChat; emoji: Reaccion }[]) {
        const lista = porMensaje.get(Number(r.mensaje_id)) ?? []
        lista.push({ emoji: r.emoji, autor: r.autor, propia: r.user_id === userId })
        porMensaje.set(Number(r.mensaje_id), lista)
    }
    const citas = new Map<number, CitaMensaje>()
    for (const m of [...mensajes, ...((citados.data ?? []) as FilaCita[])]) citas.set(Number(m.id), citaDe(m))

    return {
        mensajes: mensajes.map((m) => {
            const respondeA = m.responde_a ? Number(m.responde_a) : null
            return {
                ...m,
                responde_a: respondeA,
                cita: respondeA ? (citas.get(respondeA) ?? null) : null,
                fijado_en: m.fijado_en ?? null,
                reacciones: porMensaje.get(Number(m.id)) ?? [],
            }
        }),
        fijados: ((fijados.data ?? []) as (FilaCita & { fijado_en: string })[]).map((f) => ({ ...citaDe(f), fijado_en: f.fijado_en })),
    }
}
