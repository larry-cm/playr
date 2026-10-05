"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeft, Info, ShoppingBag } from "lucide-react"
import Card from "@ui/card"
import Alert from "@ui/alert"
import ChatBurbuja, { ChipRespuesta, citaDe, useInteraccionesMensaje, useIrAMensaje } from "@ui/chat-burbuja"
import ChatCompositor from "@ui/chat-compositor"
import ChatFijados from "@ui/chat-fijados"
import { SkeletonBar } from "@ui/data-frame"
import { formatColombianDateTime } from "@lib/date"
import { conservarUrls } from "@lib/chat-adjunto"
import { EVENTO_SIN_LEER, type AutorChat, type CitaMensaje, type MensajeFijado } from "@lib/chat-bandeja"
import { enviarMensajeStaffAction, getConversacionAction, type DetalleConversacion, type MensajeStaff } from "@action/manager-and-admin/mensajes/mensajes-action"
import type { AdjuntoSubido } from "@action/tienda/chat-asesor-action"
import PanelDetalles, { type SeccionPanel } from "@/app/administrar/mensajes/panel-detalles"
import { nombreDe } from "@/app/administrar/mensajes/bandeja-util"

/** Mientras hay una conversación abierta se buscan mensajes nuevos cada tanto. */
const CADA_MS = 5000
/** Desde xl el panel es una tercera columna; debajo, se abre encima del chat. */
const PANEL_COLUMNA = "(min-width: 80rem)"

/** Quién escribió una respuesta del asesor: "telegram:@x" → "@x (Telegram)", "panel:correo" → "correo". */
function firma(via: string | null): string {
    if (!via) return "Asesor"
    if (via.startsWith("telegram:")) return `${via.slice(9)} (Telegram)`
    if (via.startsWith("panel:")) return via.slice(6)
    return via
}

export interface EstadoPanel {
    abierto: boolean
    seccion: SeccionPanel
    /** Sube con cada apertura pedida por el usuario (el panel toma el foco solo entonces). */
    apertura: number
}

interface ChatClienteProps {
    clienteId: string
    onVolver: () => void
    panel: EstadoPanel
    onAbrirPanel: (seccion: SeccionPanel) => void
    onCerrarPanel: () => void
    debeEnfocarPanel: (apertura: number) => boolean
}

export default function ChatCliente({ clienteId, onVolver, panel, onAbrirPanel, onCerrarPanel, debeEnfocarPanel }: Readonly<ChatClienteProps>) {
    const [detalle, setDetalle] = useState<DetalleConversacion | null>(null)
    const [respondiendo, setRespondiendo] = useState<CitaMensaje | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const contenidoRef = useRef<HTMLDivElement>(null)
    const infoRef = useRef<HTMLButtonElement>(null)
    const ultimoId = useRef(0)
    // Último mensaje del cliente ya leído (al abrir el chat): si llega uno nuevo, la carga lo marca leído y cambia el total.
    const ultimoDelCliente = useRef<number | null>(null)
    // ¿El asesor está viendo el final? Si lo está, se queda ahí aunque cambie el tamaño (imagen que carga, compositor que crece).
    const alFinal = useRef(true)
    const { resaltado, irA } = useIrAMensaje(scrollRef)
    const recargarRef = useRef<() => Promise<unknown>>(async () => {})

    const modificar = useCallback(
        (cambio: (h: { mensajes: MensajeStaff[]; fijados: MensajeFijado[] }) => { mensajes: MensajeStaff[]; fijados: MensajeFijado[] }) =>
            setDetalle((d) => (d?.ok ? { ...d, ...cambio({ mensajes: d.mensajes, fijados: d.fijados }) } : d)),
        [],
    )
    const interacciones = useInteraccionesMensaje<MensajeStaff>({ autor: "asesor", modificar, recargar: () => recargarRef.current() })
    const { conPendientes } = interacciones

    const cargar = useCallback(
        () =>
            getConversacionAction(clienteId)
                .catch((): DetalleConversacion => ({ ok: false, error: "No se pudo cargar la conversación." }))
                .then((res) => {
                    setDetalle((previo) => {
                        if (!res.ok) return previo?.ok ? previo : res
                        // Las reacciones/fijados que todavía van en camino se vuelven a aplicar sobre lo leído.
                        return { ...res, ...conPendientes({ mensajes: conservarUrls(previo?.ok ? previo.mensajes : null, res.mensajes), fijados: res.fijados }) }
                    })
                    if (!res.ok) return
                    // Cada carga marca leído el chat: la insignia del menú vuelve a contar al abrirlo y cuando llega algo nuevo del cliente.
                    const delCliente = res.mensajes.findLast((m) => m.autor === "cliente")?.id ?? 0
                    if (ultimoDelCliente.current === null || delCliente !== ultimoDelCliente.current) window.dispatchEvent(new Event(EVENTO_SIN_LEER))
                    ultimoDelCliente.current = delCliente
                }),
        [clienteId, conPendientes],
    )
    useEffect(() => {
        recargarRef.current = cargar
    }, [cargar])

    useEffect(() => {
        void cargar()
        const timer = setInterval(() => {
            if (document.visibilityState === "visible") void cargar()
        }, CADA_MS)
        return () => clearInterval(timer)
    }, [cargar])

    // Se mueve solo la lista (no scrollIntoView, que también arrastra la página).
    const bajar = () => {
        const el = scrollRef.current
        if (el) el.scrollTop = el.scrollHeight
    }

    const mensajes = detalle?.ok ? detalle.mensajes : null
    useEffect(() => {
        const ultimo = mensajes?.at(-1)?.id ?? 0
        if (ultimo !== ultimoId.current) {
            ultimoId.current = ultimo
            alFinal.current = true
            bajar()
        }
    }, [mensajes])

    useEffect(() => {
        const el = scrollRef.current
        const contenido = contenidoRef.current
        if (!el || !contenido) return
        const onScroll = () => {
            alFinal.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
        }
        const observer = new ResizeObserver(() => {
            if (alFinal.current) bajar()
        })
        observer.observe(el)
        observer.observe(contenido)
        el.addEventListener("scroll", onScroll, { passive: true })
        return () => {
            observer.disconnect()
            el.removeEventListener("scroll", onScroll)
        }
    }, [])

    const enviar = async (texto: string, adjunto: AdjuntoSubido | null) => {
        const res = await enviarMensajeStaffAction(clienteId, texto, adjunto, respondiendo?.id ?? null)
        if (!res.ok) return res.error
        setRespondiendo(null)
        await cargar()
        return null
    }

    const cliente = detalle?.ok ? detalle.cliente : null
    const autorDe = (autor: AutorChat) => (autor === "asesor" ? "Asesor" : nombreDe(cliente))
    const fijados = detalle?.ok ? detalle.fijados : []
    const fijar = (cita: CitaMensaje, valor: boolean) => interacciones.fijar(cita, valor, fijados)
    const pedidos = detalle?.ok ? detalle.pedidos.length : 0

    const cerrarPanel = () => {
        onCerrarPanel()
        infoRef.current?.focus({ preventScroll: true })
    }
    // Encima del chat, saltar a un mensaje cierra el panel (si no, el salto no se vería).
    const irDesdePanel = (id: number) => {
        if (!window.matchMedia(PANEL_COLUMNA).matches) onCerrarPanel()
        // Después del cierre: el mensaje queda visible antes de medir.
        requestAnimationFrame(() => irA(id))
    }

    const botonCabecera =
        "flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-white/8 px-2.5 text-xs text-secondary transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 aria-expanded:bg-white/8 aria-expanded:text-white"

    return (
        // Chat y panel comparten el alto fijo de la bandeja: nada empuja la página.
        <div className="relative flex h-full min-h-0 min-w-0 gap-4">
            {/* Alto fijo (el de la bandeja): cargar, llegar mensajes o abrir el panel nunca cambia su tamaño; solo la lista hace scroll. */}
            <Card padding="p-3 sm:p-4" className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-3">
                {/* Encabezado de alto fijo (h-10 = nombre + correo), igual cargando que cargado. */}
                <div className="flex shrink-0 items-center gap-2 border-b border-white/8 pb-3 sm:gap-3">
                    <button type="button" onClick={onVolver} className="-ml-1 rounded-lg p-2 text-secondary hover:bg-white/5 hover:text-white lg:hidden" aria-label="Volver a la lista">
                        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        onClick={() => onAbrirPanel("inicio")}
                        className="flex h-10 min-w-0 flex-1 flex-col justify-center rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                        aria-label={`Ver detalles de ${nombreDe(cliente)}`}
                    >
                        {detalle === null ? (
                            <>
                                <SkeletonBar className="h-4 w-40" />
                                <SkeletonBar className="mt-1.5 h-3 w-56 max-w-full" />
                            </>
                        ) : (
                            <>
                                <span className="truncate text-base leading-6 font-semibold text-white">{nombreDe(cliente)}</span>
                                <span className="h-4 truncate text-xs text-secondary">{[cliente?.email, cliente?.phone].filter(Boolean).join(" · ")}</span>
                            </>
                        )}
                    </button>

                    {pedidos > 0 && (
                        <button type="button" onClick={() => onAbrirPanel("pedidos")} className={botonCabecera} aria-label={`Pedidos del cliente (${pedidos})`}>
                            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                            <span className="hidden sm:inline">Pedidos</span>
                            <span className="tabular-nums">{pedidos}</span>
                        </button>
                    )}
                    <button
                        ref={infoRef}
                        type="button"
                        onClick={() => (panel.abierto ? cerrarPanel() : onAbrirPanel("inicio"))}
                        className={`${botonCabecera} w-9 justify-center px-0`}
                        aria-expanded={panel.abierto}
                        aria-label="Detalles del chat"
                        title="Detalles del chat"
                    >
                        <Info className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>

                <ChatFijados fijados={fijados} autorDe={autorDe} onIrA={irA} onDesfijar={(f) => fijar(f, false)} />

                <div
                    ref={scrollRef}
                    className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1.5 [scrollbar-color:rgb(255_255_255/0.2)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin]"
                    aria-live="polite"
                >
                    <div ref={contenidoRef} className="flex min-h-full flex-col justify-end gap-2">
                        {detalle === null && (
                            <>
                                <SkeletonBar className="h-10 w-2/3" />
                                <SkeletonBar className="h-10 w-1/2 self-end" />
                            </>
                        )}
                        {detalle && !detalle.ok && <Alert variant="error" message={detalle.error} />}
                        {mensajes?.length === 0 && <p className="py-8 text-center text-sm text-secondary">Aún no hay mensajes con este cliente.</p>}
                        {mensajes?.map((m) => {
                            const delAsesor = m.autor === "asesor"
                            return (
                                <ChatBurbuja
                                    key={m.id}
                                    mensaje={m}
                                    propio={delAsesor}
                                    pie={`${delAsesor ? firma(m.autor_via) : nombreDe(cliente)} · ${formatColombianDateTime(m.created_at)}`}
                                    autorDe={autorDe}
                                    resaltado={resaltado === m.id}
                                    onIrA={irA}
                                    onResponder={(x) => setRespondiendo(citaDe(x))}
                                    onReaccionar={(_, emoji) => interacciones.reaccionar(m, emoji)}
                                    onFijar={(x, valor) => fijar(citaDe(x), valor)}
                                />
                            )
                        })}
                    </div>
                </div>

                {/* Esc cancela la respuesta. */}
                <div
                    className="flex shrink-0 flex-col gap-2"
                    onKeyDown={(e) => {
                        if (e.key === "Escape" && respondiendo) {
                            e.preventDefault()
                            setRespondiendo(null)
                        }
                    }}
                >
                    {interacciones.error && <Alert variant="error" message={interacciones.error} onDismiss={interacciones.cerrarError} />}
                    <ChatCompositor
                        clienteId={clienteId}
                        etiqueta="Respuesta al cliente"
                        placeholder="Escribe tu respuesta…"
                        onEnviar={enviar}
                        focusKey={respondiendo?.id ?? null}
                        encabezado={respondiendo && <ChipRespuesta cita={respondiendo} autor={autorDe(respondiendo.autor)} onCancelar={() => setRespondiendo(null)} />}
                    />
                </div>
            </Card>

            {/* Móvil: hoja encima del chat. lg: cajón a la derecha encima del chat. xl: tercera columna. */}
            {panel.abierto && (
                <div className="absolute inset-0 z-30 lg:left-auto lg:w-[22rem] xl:static xl:z-auto xl:w-80 xl:shrink-0">
                    <PanelDetalles
                        clienteId={clienteId}
                        detalle={detalle}
                        autorDe={autorDe}
                        seccion={panel.seccion}
                        apertura={panel.apertura}
                        debeEnfocar={debeEnfocarPanel}
                        onIrA={irDesdePanel}
                        onCerrar={cerrarPanel}
                    />
                </div>
            )}
        </div>
    )
}
