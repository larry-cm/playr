"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { MessageCircle, X } from "lucide-react"
import Modal from "@ui/modal"
import Alert from "@ui/alert"
import ChatBurbuja, { ChipRespuesta, citaDe, useInteraccionesMensaje, useIrAMensaje } from "@ui/chat-burbuja"
import ChatCompositor from "@ui/chat-compositor"
import ChatFijados from "@ui/chat-fijados"
import { SkeletonBar } from "@ui/data-frame"
import { formatColombianDateTime } from "@lib/date"
import { conservarUrls } from "@lib/chat-adjunto"
import type { AutorChat, CitaMensaje, MensajeFijado } from "@lib/chat-bandeja"
import { enviarMensajeAction, getMensajesAction, marcarLeidosAction, type AdjuntoSubido, type MensajeChat } from "@action/tienda/chat-asesor-action"

/** Mientras el chat está abierto (y la pestaña visible) se buscan respuestas nuevas cada tanto. */
const CADA_MS = 5000

type Hilo = { mensajes: MensajeChat[]; fijados: MensajeFijado[] }

const autorDe = (autor: AutorChat) => (autor === "cliente" ? "Tú" : "Asesor")

interface ChatAsesorProps {
    isOpen: boolean
    onClose: () => void
    /** Pedido del que se quiere hablar (se adjunta al mensaje); null = consulta general. */
    pedidoId: number | null
    onQuitarPedido: () => void
    /** Se llama al ver las respuestas (Mis compras quita el aviso de no leídos). */
    onLeidos: () => void
}

/**
 * Chat privado del cliente con el asesor. Lo que el cliente escribe le llega al asesor por Telegram; lo que el asesor
 * responde allá aparece acá (ver app/lib/telegram.ts y app/api/telegram/route.ts). Se puede responder, reaccionar y
 * fijar mensajes, igual que en la bandeja del staff.
 */
export default function ChatAsesor({ isOpen, onClose, pedidoId, onQuitarPedido, onLeidos }: Readonly<ChatAsesorProps>) {
    const [hilo, setHilo] = useState<Hilo | null>(null)
    // El error de un envío (p. ej. el límite de mensajes) lo muestra el compositor: la consulta periódica no lo borra.
    const [errorCarga, setErrorCarga] = useState<string | null>(null)
    const [respondiendo, setRespondiendo] = useState<CitaMensaje | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const finRef = useRef<HTMLDivElement>(null)
    const ultimoId = useRef(0)
    const { resaltado, irA } = useIrAMensaje(scrollRef)
    const recargarRef = useRef<() => Promise<unknown>>(async () => {})

    const modificar = useCallback((cambio: (h: Hilo) => Hilo) => setHilo((h) => (h ? cambio(h) : h)), [])
    const interacciones = useInteraccionesMensaje<MensajeChat>({ autor: "cliente", modificar, recargar: () => recargarRef.current() })
    const { conPendientes } = interacciones

    const cargar = useCallback(
        () =>
            getMensajesAction()
                .catch(() => ({ ok: false as const, error: "No se pudo cargar la conversación." }))
                .then((res) => {
                    if (!res.ok) {
                        setErrorCarga(res.error)
                        return
                    }
                    setErrorCarga(null)
                    // Las reacciones/fijados que todavía van en camino se vuelven a aplicar sobre lo leído.
                    setHilo((previo) => conPendientes({ mensajes: conservarUrls(previo?.mensajes, res.mensajes), fijados: res.fijados }))
                    if (res.mensajes.some((m) => m.autor === "asesor" && !m.leido)) {
                        void marcarLeidosAction().catch(() => {}).then(onLeidos)
                    }
                }),
        [onLeidos, conPendientes],
    )
    useEffect(() => {
        recargarRef.current = cargar
    }, [cargar])

    useEffect(() => {
        if (!isOpen) return
        void cargar()
        const timer = setInterval(() => {
            if (document.visibilityState === "visible") void cargar()
        }, CADA_MS)
        return () => clearInterval(timer)
    }, [isOpen, cargar])

    const mensajes = hilo?.mensajes ?? null
    const fijados = hilo?.fijados ?? []

    // Baja al último mensaje solo cuando llega uno nuevo (no en cada consulta).
    useEffect(() => {
        const ultimo = mensajes?.at(-1)?.id ?? 0
        if (ultimo !== ultimoId.current) {
            ultimoId.current = ultimo
            finRef.current?.scrollIntoView({ block: "end" })
        }
    }, [mensajes])

    const enviar = async (texto: string, adjunto: AdjuntoSubido | null) => {
        const res = await enviarMensajeAction(texto, pedidoId, adjunto, respondiendo?.id ?? null)
        if (!res.ok) return res.error
        onQuitarPedido()
        setRespondiendo(null)
        await cargar()
        return null
    }

    const fijar = (cita: CitaMensaje, valor: boolean) => interacciones.fijar(cita, valor, fijados)

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Chat con el asesor">
            <div className="flex flex-col gap-3">
                <p className="text-xs text-secondary">Escríbenos por aquí (también puedes enviar una imagen o una nota de voz): el asesor recibe tu mensaje al instante y te responde en este chat.</p>

                <ChatFijados fijados={fijados} autorDe={autorDe} onIrA={irA} onDesfijar={(f) => fijar(f, false)} />

                <div ref={scrollRef} className="flex max-h-[50vh] min-h-48 flex-col gap-2 overflow-y-auto rounded-xl border border-white/8 bg-white/2 p-3" aria-live="polite">
                    {mensajes === null && !errorCarga && (
                        <>
                            <SkeletonBar className="h-10 w-2/3" />
                            <SkeletonBar className="h-10 w-1/2 self-end" />
                        </>
                    )}
                    {mensajes?.length === 0 && (
                        <div className="m-auto flex flex-col items-center gap-2 text-center text-secondary">
                            <MessageCircle className="h-6 w-6" aria-hidden="true" />
                            <p className="text-sm">Aún no hay mensajes. Cuéntanos en qué te ayudamos.</p>
                        </div>
                    )}
                    {mensajes?.map((m) => {
                        const propio = m.autor === "cliente"
                        return (
                            <ChatBurbuja
                                key={m.id}
                                mensaje={m}
                                propio={propio}
                                pie={`${propio ? "Tú" : "Asesor"} · ${formatColombianDateTime(m.created_at)}`}
                                autorDe={autorDe}
                                resaltado={resaltado === m.id}
                                onIrA={irA}
                                onResponder={(x) => setRespondiendo(citaDe(x))}
                                onReaccionar={(_, emoji) => interacciones.reaccionar(m, emoji)}
                                onFijar={(x, valor) => fijar(citaDe(x), valor)}
                            />
                        )
                    })}
                    <div ref={finRef} />
                </div>

                {errorCarga && <Alert variant="error" message={errorCarga} />}
                {interacciones.error && <Alert variant="error" message={interacciones.error} onDismiss={interacciones.cerrarError} />}
                {/* Esc cancela la respuesta (preventDefault: el modal no se cierra con ese Esc). */}
                <div
                    onKeyDown={(e) => {
                        if (e.key === "Escape" && respondiendo) {
                            e.preventDefault()
                            setRespondiendo(null)
                        }
                    }}
                >
                    <ChatCompositor
                        etiqueta="Mensaje para el asesor"
                        placeholder="Escribe tu mensaje…"
                        onEnviar={enviar}
                        focusKey={respondiendo?.id ?? null}
                        encabezado={
                            (respondiendo || pedidoId !== null) && (
                                <div className="flex flex-col gap-2">
                                    {pedidoId !== null && (
                                        <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-white/10 bg-white/5 py-0.5 pl-2.5 pr-1 text-xs text-white/80">
                                            Sobre el pedido #{pedidoId}
                                            <button type="button" onClick={onQuitarPedido} className="rounded-full p-0.5 hover:bg-white/10" aria-label="Quitar el pedido del mensaje">
                                                <X className="h-3 w-3" aria-hidden="true" />
                                            </button>
                                        </span>
                                    )}
                                    {respondiendo && <ChipRespuesta cita={respondiendo} autor={autorDe(respondiendo.autor)} onCancelar={() => setRespondiendo(null)} />}
                                </div>
                            )
                        }
                    />
                </div>
            </div>
        </Modal>
    )
}
