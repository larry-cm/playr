"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react"
import { createPortal } from "react-dom"
import { Check, Copy, Ellipsis, Pin, PinOff, Reply, SmilePlus, X } from "lucide-react"
import ChatAdjunto from "@ui/chat-adjunto"
import { resumenMensaje, type TipoAdjunto } from "@lib/chat-adjunto"
import { fijarMensajeAction, reaccionarMensajeAction } from "@action/chat-mensaje-action"
import {
    MENSAJES_FIJADOS_MAX,
    REACCIONES,
    recortar,
    type AutorChat,
    type CitaMensaje,
    type InteraccionesMensaje,
    type MensajeFijado,
    type Reaccion,
} from "@lib/chat-bandeja"

/** Lo que necesita una burbuja (lo cumplen los mensajes del staff y los del cliente). */
export interface MensajeBurbuja extends InteraccionesMensaje {
    id: number
    autor: AutorChat
    texto: string
    pedido_id: number | null
    adjunto_tipo: TipoAdjunto | null
    adjunto_url: string | null
    created_at: string
}

/** Mantener presionado (táctil) abre el menú del mensaje. */
const PRESION_MS = 450
/** Cuánto queda resaltado el mensaje al que se salta (cita o fijado). */
const RESALTE_MS = 1600

/** Vista previa de un mensaje para citarlo (respuesta) o fijarlo. */
export const citaDe = (m: MensajeBurbuja): CitaMensaje => ({ id: m.id, autor: m.autor, texto: recortar(resumenMensaje(m), 120), adjunto_tipo: m.adjunto_tipo })

/** Color del autor en citas y fijados: el asesor en violeta (acento), el cliente en celeste; igual en los dos chats. */
export const colorAutor = (autor: AutorChat) => (autor === "asesor" ? "border-accent text-accent-hover" : "border-sky-400 text-sky-300")

const reducirMovimiento = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

// --- Saltar a un mensaje -------------------------------------------------------------------------------------------

/**
 * Lleva la lista (solo ella: scrollIntoView también movería la página o el modal) hasta un mensaje cargado y lo resalta
 * un momento. Devuelve false si el mensaje no está en la lista.
 */
export function useIrAMensaje(scrollRef: RefObject<HTMLElement | null>) {
    const [resaltado, setResaltado] = useState<number | null>(null)
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    useEffect(() => () => clearTimeout(timer.current), [])

    const irA = useCallback(
        (id: number) => {
            const lista = scrollRef.current
            const el = lista?.querySelector<HTMLElement>(`[data-mensaje-id="${id}"]`)
            if (!lista || !el) return false
            const caja = lista.getBoundingClientRect()
            const r = el.getBoundingClientRect()
            const top = lista.scrollTop + r.top - caja.top - (lista.clientHeight - Math.min(r.height, lista.clientHeight)) / 2
            lista.scrollTo({ top, behavior: reducirMovimiento() ? "auto" : "smooth" })
            setResaltado(id)
            clearTimeout(timer.current)
            timer.current = setTimeout(() => setResaltado(null), RESALTE_MS)
            return true
        },
        [scrollRef],
    )
    return { resaltado, irA }
}

// --- Reacciones y fijados con respuesta inmediata ------------------------------------------------------------------

type Hilo<M> = { mensajes: M[]; fijados: MensajeFijado[] }
type Cambio<M> = (h: Hilo<M>) => Hilo<M>

/** La reacción propia de un mensaje pasa a ser `emoji` (null = ninguna). */
const conReaccion = <M extends MensajeBurbuja>(m: M, emoji: Reaccion | null, autor: AutorChat): M => ({
    ...m,
    reacciones: [...m.reacciones.filter((r) => !r.propia), ...(emoji ? [{ emoji, autor, propia: true }] : [])],
})

const cambiarReaccion = <M extends MensajeBurbuja>(id: number, emoji: Reaccion | null, autor: AutorChat): Cambio<M> => (h) => ({
    ...h,
    mensajes: h.mensajes.map((m) => (m.id === id ? conReaccion(m, emoji, autor) : m)),
})

/** Fija (al principio de la lista; el 4.º saca al más viejo, como la base) o desfija. */
const cambiarFijado = <M extends MensajeBurbuja>(cita: CitaMensaje, fijar: boolean, cuando: string): Cambio<M> => (h) => {
    const otros = h.fijados.filter((f) => f.id !== cita.id)
    const fijados = fijar ? [{ ...cita, fijado_en: h.fijados.find((f) => f.id === cita.id)?.fijado_en ?? cuando }, ...otros].slice(0, MENSAJES_FIJADOS_MAX) : otros
    const quedan = new Map(fijados.map((f) => [f.id, f.fijado_en]))
    return { mensajes: h.mensajes.map((m) => (m.fijado_en || quedan.has(m.id) ? { ...m, fijado_en: quedan.get(m.id) ?? null } : m)), fijados }
}

interface OpcionesInteracciones<M> {
    /** Quién mira: su reacción se guarda con este autor. */
    autor: AutorChat
    /** Aplica un cambio al hilo cargado (mensajes + fijados). */
    modificar: (cambio: Cambio<M>) => void
    /** Vuelve a leer la conversación del servidor. */
    recargar: () => Promise<unknown>
}

/**
 * Reaccionar y fijar con respuesta inmediata: el cambio se ve al instante, se manda al servidor y, si falla, se deshace
 * y queda el error. Mientras está en camino, `conPendientes` lo vuelve a aplicar sobre lo que traiga la consulta
 * periódica (si no, la reacción parpadearía).
 */
export function useInteraccionesMensaje<M extends MensajeBurbuja>({ autor, modificar, recargar }: OpcionesInteracciones<M>) {
    const [error, setError] = useState<string | null>(null)
    const pendientes = useRef(new Map<string, { token: symbol; cambio: Cambio<M> }>())
    const recargarRef = useRef(recargar)
    useEffect(() => {
        recargarRef.current = recargar
    })

    // El error se va solo después de un rato (y con la X).
    useEffect(() => {
        if (!error) return
        const t = setTimeout(() => setError(null), 6000)
        return () => clearTimeout(t)
    }, [error])

    const conPendientes = useCallback((h: Hilo<M>) => [...pendientes.current.values()].reduce((acc, p) => p.cambio(acc), h), [])

    const ejecutar = useCallback(
        async (clave: string, cambio: Cambio<M>, deshacer: Cambio<M>, accion: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
            const token = Symbol(clave)
            pendientes.current.set(clave, { token, cambio })
            modificar(cambio)
            setError(null)
            const res = await accion().catch(() => ({ ok: false as const, error: "No se pudo guardar el cambio. Revisa tu conexión." }))
            if (pendientes.current.get(clave)?.token === token) pendientes.current.delete(clave)
            if (!res.ok) {
                modificar(deshacer)
                setError(res.error)
            }
            await recargarRef.current().catch(() => {})
        },
        [modificar],
    )

    /** Toca un emoji: si ya era el propio lo quita; si no, lo pone (reemplaza el anterior). */
    const reaccionar = useCallback(
        (m: M, emoji: Reaccion) => {
            const anterior = m.reacciones.find((r) => r.propia)?.emoji ?? null
            const nuevo = anterior === emoji ? null : emoji
            void ejecutar(`reaccion:${m.id}`, cambiarReaccion<M>(m.id, nuevo, autor), cambiarReaccion<M>(m.id, anterior, autor), () => reaccionarMensajeAction(m.id, nuevo))
        },
        [autor, ejecutar],
    )

    /** Fija o desfija. `fijadosAntes` = la lista antes del cambio (para deshacer también al que sacó el 4.º). */
    const fijar = useCallback(
        (cita: CitaMensaje, valor: boolean, fijadosAntes: MensajeFijado[]) => {
            const deshacer: Cambio<M> = (h) => {
                const antes = new Map(fijadosAntes.map((f) => [f.id, f.fijado_en]))
                return { fijados: fijadosAntes, mensajes: h.mensajes.map((m) => (m.fijado_en || antes.has(m.id) ? { ...m, fijado_en: antes.get(m.id) ?? null } : m)) }
            }
            void ejecutar(`fijar:${cita.id}`, cambiarFijado<M>(cita, valor, new Date().toISOString()), deshacer, () => fijarMensajeAction(cita.id, valor))
        },
        [ejecutar],
    )

    return { reaccionar, fijar, conPendientes, error, cerrarError: () => setError(null) }
}

// --- Chip "Respondiendo a" -----------------------------------------------------------------------------------------

/** Va sobre la caja de texto mientras se responde un mensaje. */
export function ChipRespuesta({ cita, autor, onCancelar }: Readonly<{ cita: CitaMensaje; autor: string; onCancelar: () => void }>) {
    return (
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] py-1.5 pl-2.5 pr-1">
            <Reply className="h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
            <div className={`min-w-0 flex-1 border-l-2 pl-2 [contain:inline-size] ${colorAutor(cita.autor)}`}>
                <p className="text-[11px] font-semibold leading-4">{autor === "Tú" ? "Respondiendo a tu mensaje" : `Respondiendo a ${autor}`}</p>
                <p className="truncate text-xs leading-4 text-white/70">{cita.texto}</p>
            </div>
            <button
                type="button"
                onClick={onCancelar}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-secondary hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                aria-label="Cancelar la respuesta"
                title="Cancelar (Esc)"
            >
                <X className="h-4 w-4" aria-hidden="true" />
            </button>
        </div>
    )
}

// --- Menú del mensaje ----------------------------------------------------------------------------------------------

const itemMenu =
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-white/90 hover:bg-white/8 focus-visible:bg-white/8 focus-visible:outline-none"

interface MenuProps {
    ancla: HTMLElement
    /** Botón que abre y cierra el menú: tocarlo no cuenta como "clic afuera". */
    disparador: HTMLElement | null
    /** El borde de la burbuja con el que se alinea (la propia a la derecha). */
    lado: "izquierda" | "derecha"
    propia: Reaccion | null
    fijado: boolean
    puedeCopiar: boolean
    onCerrar: (devolverFoco: boolean) => void
    onReaccionar?: (emoji: Reaccion) => void
    onResponder?: () => void
    onFijar?: () => void
    onCopiar?: () => void
}

/**
 * Menú flotante del mensaje (reacciones + acciones). Va en un portal con posición fija: dentro de la lista se recortaría
 * con su scroll. En el chat del cliente el portal es el propio diálogo, así sigue dentro de la trampa de foco del modal.
 */
function MenuMensaje({ ancla, disparador, lado, propia, fijado, puedeCopiar, onCerrar, onReaccionar, onResponder, onFijar, onCopiar }: Readonly<MenuProps>) {
    const ref = useRef<HTMLDivElement>(null)
    const onCerrarRef = useRef(onCerrar)
    useEffect(() => {
        onCerrarRef.current = onCerrar
    })

    // Se ubica tocando el estilo directo (sin estado): sigue al mensaje en cada scroll sin re-renderizar.
    const ubicar = useCallback(() => {
        const menu = ref.current
        if (!menu) return
        const a = ancla.getBoundingClientRect()
        const { width: w, height: h } = menu.getBoundingClientRect()
        const margen = 8
        const left = Math.min(Math.max(margen, lado === "derecha" ? a.right - w : a.left), window.innerWidth - w - margen)
        const abajo = a.bottom + 6
        const arriba = a.top - h - 6
        const top = abajo + h <= window.innerHeight - margen || arriba < margen ? Math.min(abajo, window.innerHeight - h - margen) : arriba
        menu.style.top = `${Math.max(margen, top)}px`
        menu.style.left = `${left}px`
        menu.style.visibility = "visible"
    }, [ancla, lado])

    useLayoutEffect(() => {
        ubicar()
        ref.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true })
    }, [ubicar])

    useEffect(() => {
        const fuera = (e: PointerEvent) => {
            const t = e.target as Node
            if (!ref.current?.contains(t) && !disparador?.contains(t)) onCerrarRef.current(false)
        }
        document.addEventListener("pointerdown", fuera)
        window.addEventListener("resize", ubicar)
        // scroll de cualquier contenedor (la lista del chat, el modal, la página): el menú sigue a su mensaje
        window.addEventListener("scroll", ubicar, true)
        return () => {
            document.removeEventListener("pointerdown", fuera)
            window.removeEventListener("resize", ubicar)
            window.removeEventListener("scroll", ubicar, true)
        }
    }, [disparador, ubicar])

    const destino = ancla.closest<HTMLElement>('[role="dialog"]') ?? document.body
    const elegir = (accion?: () => void) => () => {
        onCerrar(false)
        accion?.()
    }

    return createPortal(
        <div
            ref={ref}
            role="group"
            aria-label="Acciones del mensaje"
            onKeyDown={(e) => {
                if (e.key === "Escape") {
                    // preventDefault: el modal del chat del cliente no se cierra con este Esc
                    e.preventDefault()
                    e.stopPropagation()
                    onCerrar(true)
                }
            }}
            style={{ top: 0, left: 0, visibility: "hidden" }}
            className="fixed z-[60] w-60 rounded-2xl border border-white/10 bg-[#16161f] p-1.5 shadow-2xl shadow-black/60"
        >
            {onReaccionar && (
                <div className="flex items-center justify-between gap-0.5 border-b border-white/8 px-0.5 pb-1.5" role="group" aria-label="Reaccionar">
                    {REACCIONES.map((emoji) => (
                        <button
                            key={emoji}
                            type="button"
                            onClick={elegir(() => onReaccionar(emoji))}
                            aria-pressed={propia === emoji}
                            aria-label={propia === emoji ? `Quitar tu reacción ${emoji}` : `Reaccionar con ${emoji}`}
                            title={propia === emoji ? "Quitar tu reacción" : undefined}
                            className={`grid h-9 w-9 place-items-center rounded-full text-xl leading-none transition-transform motion-safe:hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                                propia === emoji ? "bg-accent/30" : "hover:bg-white/8"
                            }`}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}
            <div className={onReaccionar ? "pt-1" : undefined}>
                {onResponder && (
                    <button type="button" onClick={elegir(onResponder)} className={itemMenu}>
                        <Reply className="h-4 w-4 text-secondary" aria-hidden="true" /> Responder
                    </button>
                )}
                {onFijar && (
                    <button type="button" onClick={elegir(onFijar)} className={itemMenu}>
                        {fijado ? <PinOff className="h-4 w-4 text-secondary" aria-hidden="true" /> : <Pin className="h-4 w-4 text-secondary" aria-hidden="true" />}
                        {fijado ? "Desfijar" : "Fijar"}
                    </button>
                )}
                {puedeCopiar && onCopiar && (
                    <button type="button" onClick={elegir(onCopiar)} className={itemMenu}>
                        <Copy className="h-4 w-4 text-secondary" aria-hidden="true" /> Copiar texto
                    </button>
                )}
            </div>
        </div>,
        destino,
    )
}

// --- Burbuja -------------------------------------------------------------------------------------------------------

const botonBarra =
    "relative grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-background/80 text-secondary transition-colors after:absolute after:-inset-1.5 after:content-[''] hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"

interface ChatBurbujaProps {
    mensaje: MensajeBurbuja
    /** Lo escribió quien mira: va a la derecha. */
    propio: boolean
    /** Línea de abajo (quién · cuándo). */
    pie: string
    /** Nombre de cada lado en citas y reacciones ("Tú", "Asesor", el cliente…). */
    autorDe: (autor: AutorChat) => string
    resaltado?: boolean
    /** Clic en la cita: saltar al mensaje original. */
    onIrA?: (id: number) => void
    // Sin la función, la acción no aparece.
    onResponder?: (m: MensajeBurbuja) => void
    onReaccionar?: (m: MensajeBurbuja, emoji: Reaccion) => void
    onFijar?: (m: MensajeBurbuja, fijar: boolean) => void
}

/**
 * Un mensaje del chat con el asesor (staff y cliente): cita de lo que responde, adjunto, texto, reacciones agrupadas y
 * marca de fijado. Acciones: barra al pasar el mouse, botón "⋯" (siempre visible en pantallas táctiles) o mantener
 * presionado.
 */
export default function ChatBurbuja({ mensaje: m, propio, pie, autorDe, resaltado = false, onIrA, onResponder, onReaccionar, onFijar }: Readonly<ChatBurbujaProps>) {
    const burbujaRef = useRef<HTMLDivElement>(null)
    const masRef = useRef<HTMLButtonElement>(null)
    // Menú abierto: la burbuja a la que se ancla y el botón "⋯" (vuelve ahí el foco al cerrar con Esc).
    const [menuDe, setMenuDe] = useState<{ ancla: HTMLElement; disparador: HTMLElement | null } | null>(null)
    const menu = menuDe !== null
    const abrirMenu = () => {
        if (burbujaRef.current) setMenuDe({ ancla: burbujaRef.current, disparador: masRef.current })
    }
    const [copiado, setCopiado] = useState(false)
    const presion = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null)
    const presionado = useRef(false)

    useEffect(() => {
        if (!copiado) return
        const t = setTimeout(() => setCopiado(false), 1500)
        return () => clearTimeout(t)
    }, [copiado])
    useEffect(() => () => clearTimeout(presion.current?.timer), [])

    const propia = m.reacciones.find((r) => r.propia)?.emoji ?? null
    const hayAcciones = !!(onResponder || onReaccionar || onFijar || m.texto)

    // Reacciones agrupadas por emoji (en el orden en que llegaron), con quién puso cada una.
    const grupos: { emoji: Reaccion; quienes: string[]; mia: boolean }[] = []
    for (const r of m.reacciones) {
        let g = grupos.find((x) => x.emoji === r.emoji)
        if (!g) grupos.push((g = { emoji: r.emoji, quienes: [], mia: false }))
        g.quienes.push(r.propia ? "Tú" : autorDe(r.autor))
        g.mia ||= r.propia
    }

    const cancelarPresion = () => {
        clearTimeout(presion.current?.timer)
        presion.current = null
    }

    const copiar = () => {
        void navigator.clipboard?.writeText(m.texto).then(() => setCopiado(true), () => {})
    }

    return (
        <div data-mensaje-id={m.id} className={`group/msg flex w-full flex-col gap-0.5 ${propio ? "items-end" : "items-start"}`}>
            <div className={`flex w-full items-center gap-1.5 ${propio ? "flex-row-reverse" : ""}`}>
                <div
                    ref={burbujaRef}
                    onPointerDown={(e) => {
                        presionado.current = false
                        if (e.pointerType !== "touch" || !hayAcciones || (e.target as HTMLElement).closest("button, input")) return
                        const { clientX: x, clientY: y } = e
                        presion.current = {
                            x,
                            y,
                            timer: setTimeout(() => {
                                presionado.current = true
                                presion.current = null
                                navigator.vibrate?.(10)
                                abrirMenu()
                            }, PRESION_MS),
                        }
                    }}
                    onPointerMove={(e) => {
                        const p = presion.current
                        if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) cancelarPresion()
                    }}
                    onPointerUp={cancelarPresion}
                    onPointerCancel={cancelarPresion}
                    onContextMenu={(e) => {
                        // El mantener presionado ya abrió el menú: sin el menú del navegador encima.
                        if (presionado.current) e.preventDefault()
                    }}
                    onClickCapture={(e) => {
                        // Soltar después de mantener presionado no abre la imagen ni sigue la cita.
                        if (presionado.current) {
                            e.preventDefault()
                            e.stopPropagation()
                            presionado.current = false
                        }
                    }}
                    className={`min-w-0 max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm text-white transition-[box-shadow,background-color] duration-300 [-webkit-touch-callout:none] ${
                        propio ? "rounded-br-md bg-accent/25" : "rounded-bl-md bg-white/8"
                    } ${resaltado ? "bg-accent/40 ring-2 ring-accent/70" : "ring-0 ring-transparent"}`}
                >
                    {m.responde_a !== null &&
                        (m.cita ? (
                            <button
                                type="button"
                                onClick={() => onIrA?.(m.cita!.id)}
                                className={`-mx-1 mb-1 block w-[calc(100%+0.5rem)] min-w-40 rounded-lg [contain:inline-size] border-l-2 bg-black/25 px-2 py-1 text-left hover:bg-black/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${colorAutor(m.cita.autor)}`}
                                aria-label={`Ir al mensaje de ${autorDe(m.cita.autor)}: ${m.cita.texto}`}
                            >
                                <span className="block text-[11px] font-semibold leading-4">{autorDe(m.cita.autor)}</span>
                                <span className="block truncate text-xs leading-4 text-white/70">{m.cita.texto}</span>
                            </button>
                        ) : (
                            <span className="-mx-1 mb-1 block rounded-lg border-l-2 border-white/20 bg-black/25 px-2 py-1 text-xs italic text-white/50">Mensaje eliminado</span>
                        ))}
                    {m.pedido_id !== null && <span className="mb-0.5 block text-[11px] font-medium text-white/60">Pedido #{m.pedido_id}</span>}
                    {m.adjunto_tipo && <ChatAdjunto tipo={m.adjunto_tipo} url={m.adjunto_url} />}
                    {m.texto && <span className={m.adjunto_tipo ? "mt-1 block" : undefined}>{m.texto}</span>}
                </div>

                {hayAcciones && (
                    // Con mouse: aparece al pasar por el mensaje (o con el foco). En pantallas táctiles solo queda el "⋯", tenue.
                    <div
                        className={`flex shrink-0 items-center gap-1 transition-opacity duration-150 ${propio ? "flex-row-reverse" : ""} ${
                            menu ? "opacity-100" : "opacity-60 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/msg:opacity-100 [@media(hover:hover)]:group-focus-within/msg:opacity-100"
                        }`}
                    >
                        {onReaccionar && (
                            <button type="button" tabIndex={-1} onClick={abrirMenu} className={`${botonBarra} hidden [@media(hover:hover)]:grid`} aria-label="Reaccionar" title="Reaccionar">
                                <SmilePlus className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                        )}
                        {onResponder && (
                            <button type="button" tabIndex={-1} onClick={() => onResponder(m)} className={`${botonBarra} hidden [@media(hover:hover)]:grid`} aria-label="Responder" title="Responder">
                                <Reply className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                        )}
                        <button
                            ref={masRef}
                            type="button"
                            onClick={() => (menu ? setMenuDe(null) : abrirMenu())}
                            className={botonBarra}
                            aria-label="Más acciones del mensaje"
                            aria-haspopup="true"
                            aria-expanded={menu}
                            title="Más acciones"
                        >
                            <Ellipsis className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                    </div>
                )}
            </div>

            {grupos.length > 0 && (
                <div className={`flex max-w-[80%] flex-wrap gap-1 ${propio ? "justify-end" : ""}`}>
                    {grupos.map((g) => {
                        const quienes = g.quienes.join(", ")
                        const etiqueta = onReaccionar ? (g.mia ? `${g.emoji}: ${quienes}. Quitar tu reacción` : `${g.emoji}: ${quienes}. Reaccionar con ${g.emoji}`) : `${g.emoji}: ${quienes}`
                        const contenido = (
                            <>
                                <span className="text-sm leading-none">{g.emoji}</span>
                                {g.quienes.length > 1 && <span className="tabular-nums">{g.quienes.length}</span>}
                            </>
                        )
                        const clase = `inline-flex h-6 items-center gap-1 rounded-full border px-1.5 text-[11px] text-white/80 ${
                            g.mia ? "border-accent/60 bg-accent/20" : "border-white/10 bg-white/5"
                        }`
                        return onReaccionar ? (
                            <button
                                key={g.emoji}
                                type="button"
                                onClick={() => onReaccionar(m, g.emoji)}
                                aria-pressed={g.mia}
                                aria-label={etiqueta}
                                title={quienes}
                                className={`${clase} transition-colors hover:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60`}
                            >
                                {contenido}
                            </button>
                        ) : (
                            <span key={g.emoji} className={clase} title={quienes} aria-label={etiqueta} role="img">
                                {contenido}
                            </span>
                        )
                    })}
                </div>
            )}

            <span className="flex items-center gap-1 px-1 text-[11px] text-secondary">
                {m.fijado_en && <Pin className="h-3 w-3 rotate-45 text-white/60" aria-label="Mensaje fijado" role="img" />}
                {copiado ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400" role="status">
                        <Check className="h-3 w-3" aria-hidden="true" /> Texto copiado
                    </span>
                ) : (
                    pie
                )}
            </span>

            {menuDe && (
                <MenuMensaje
                    ancla={menuDe.ancla}
                    disparador={menuDe.disparador}
                    lado={propio ? "derecha" : "izquierda"}
                    propia={propia}
                    fijado={!!m.fijado_en}
                    puedeCopiar={!!m.texto}
                    onCerrar={(devolverFoco) => {
                        setMenuDe(null)
                        if (devolverFoco) menuDe.disparador?.focus({ preventScroll: true })
                    }}
                    onReaccionar={onReaccionar && ((emoji) => onReaccionar(m, emoji))}
                    onResponder={onResponder && (() => onResponder(m))}
                    onFijar={onFijar && (() => onFijar(m, !m.fijado_en))}
                    onCopiar={copiar}
                />
            )}
        </div>
    )
}
