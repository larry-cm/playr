"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { MessageCircle, X } from "lucide-react"
import Modal from "@ui/modal"
import Alert from "@ui/alert"
import ChatAdjunto from "@ui/chat-adjunto"
import ChatCompositor from "@ui/chat-compositor"
import { SkeletonBar } from "@ui/data-frame"
import { formatColombianDateTime } from "@lib/date"
import { conservarUrls } from "@lib/chat-adjunto"
import { enviarMensajeAction, getMensajesAction, marcarLeidosAction, type AdjuntoSubido, type MensajeChat } from "@action/tienda/chat-asesor-action"

/** Mientras el chat está abierto (y la pestaña visible) se buscan respuestas nuevas cada tanto. */
const CADA_MS = 5000

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
 * responde allá aparece acá (ver app/lib/telegram.ts y app/api/telegram/route.ts).
 */
export default function ChatAsesor({ isOpen, onClose, pedidoId, onQuitarPedido, onLeidos }: Readonly<ChatAsesorProps>) {
    const [mensajes, setMensajes] = useState<MensajeChat[] | null>(null)
    // El error de un envío (p. ej. el límite de mensajes) lo muestra el compositor: la consulta periódica no lo borra.
    const [errorCarga, setErrorCarga] = useState<string | null>(null)
    const finRef = useRef<HTMLDivElement>(null)
    const ultimoId = useRef(0)

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
                    setMensajes((previos) => conservarUrls(previos, res.mensajes))
                    if (res.mensajes.some((m) => m.autor === "asesor" && !m.leido)) {
                        void marcarLeidosAction().catch(() => {}).then(onLeidos)
                    }
                }),
        [onLeidos],
    )

    useEffect(() => {
        if (!isOpen) return
        void cargar()
        const timer = setInterval(() => {
            if (document.visibilityState === "visible") void cargar()
        }, CADA_MS)
        return () => clearInterval(timer)
    }, [isOpen, cargar])

    // Baja al último mensaje solo cuando llega uno nuevo (no en cada consulta).
    useEffect(() => {
        const ultimo = mensajes?.at(-1)?.id ?? 0
        if (ultimo !== ultimoId.current) {
            ultimoId.current = ultimo
            finRef.current?.scrollIntoView({ block: "end" })
        }
    }, [mensajes])

    const enviar = async (texto: string, adjunto: AdjuntoSubido | null) => {
        const res = await enviarMensajeAction(texto, pedidoId, adjunto)
        if (!res.ok) return res.error
        onQuitarPedido()
        await cargar()
        return null
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Chat con el asesor">
            <div className="flex flex-col gap-3">
                <p className="text-xs text-secondary">Escríbenos por aquí (también puedes enviar una imagen o una nota de voz): el asesor recibe tu mensaje al instante y te responde en este chat.</p>

                <div className="flex max-h-[50vh] min-h-48 flex-col gap-2 overflow-y-auto rounded-xl border border-white/8 bg-white/2 p-3" aria-live="polite">
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
                            <div key={m.id} className={`flex max-w-[85%] flex-col gap-0.5 ${propio ? "self-end items-end" : "self-start items-start"}`}>
                                <div className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${propio ? "rounded-br-md bg-accent/25 text-white" : "rounded-bl-md bg-white/8 text-white"}`}>
                                    {m.pedido_id !== null && <span className="mb-0.5 block text-[11px] font-medium text-white/60">Pedido #{m.pedido_id}</span>}
                                    {m.adjunto_tipo && <ChatAdjunto tipo={m.adjunto_tipo} url={m.adjunto_url} />}
                                    {m.texto && <span className={m.adjunto_tipo ? "mt-1 block" : undefined}>{m.texto}</span>}
                                </div>
                                <span className="px-1 text-[11px] text-secondary">
                                    {propio ? "Tú" : "Asesor"} · {formatColombianDateTime(m.created_at)}
                                </span>
                            </div>
                        )
                    })}
                    <div ref={finRef} />
                </div>

                {errorCarga && <Alert variant="error" message={errorCarga} />}
                <ChatCompositor
                    etiqueta="Mensaje para el asesor"
                    placeholder="Escribe tu mensaje…"
                    onEnviar={enviar}
                    encabezado={
                        pedidoId !== null && (
                            <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-white/10 bg-white/5 py-0.5 pl-2.5 pr-1 text-xs text-white/80">
                                Sobre el pedido #{pedidoId}
                                <button type="button" onClick={onQuitarPedido} className="rounded-full p-0.5 hover:bg-white/10" aria-label="Quitar el pedido del mensaje">
                                    <X className="h-3 w-3" aria-hidden="true" />
                                </button>
                            </span>
                        )
                    }
                />
            </div>
        </Modal>
    )
}
