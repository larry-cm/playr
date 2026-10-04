"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { FileUp, MessageCircle, X } from "lucide-react"
import Modal from "@ui/modal"
import Alert from "@ui/alert"
import Button from "@ui/button"
import ChatAdjunto from "@ui/chat-adjunto"
import ChatCompositor from "@ui/chat-compositor"
import { SkeletonBar } from "@ui/data-frame"
import { formatColombianDateTime } from "@lib/date"
import { conservarUrls } from "@lib/chat-adjunto"
import { formatCOP } from "@lib/currency"
import { COMPROBANTE_ACCEPT } from "@lib/pedido"
import { enviarComprobante } from "@/app/administrar/compras/enviar-comprobante"
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
    /** Pedido del pago por QR que espera su comprobante (hay a lo sumo uno); null = ninguno. */
    esperando: { id: number; total: number } | null
    /** Se llama al entregar el comprobante (Mis compras recarga los pedidos). */
    onComprobante: () => void
}

/**
 * Chat privado del cliente con el asesor. Lo que el cliente escribe le llega al asesor por Telegram; lo que el asesor
 * responde allá aparece acá (ver app/lib/telegram.ts y app/api/telegram/route.ts). Si hay un pago por QR esperando el
 * comprobante, un botón lo entrega (va al pedido, no como adjunto normal del chat), y mientras tanto la imagen o el PDF
 * que se adjunte en el compositor también va como comprobante (decisión del usuario: el primero que llega se asocia).
 */
export default function ChatAsesor({ isOpen, onClose, pedidoId, onQuitarPedido, onLeidos, esperando, onComprobante }: Readonly<ChatAsesorProps>) {
    const [mensajes, setMensajes] = useState<MensajeChat[] | null>(null)
    // El error de un envío (p. ej. el límite de mensajes) lo muestra el compositor: la consulta periódica no lo borra.
    const [errorCarga, setErrorCarga] = useState<string | null>(null)
    const finRef = useRef<HTMLDivElement>(null)
    const ultimoId = useRef(0)
    const comprobanteRef = useRef<HTMLInputElement>(null)
    const [subiendo, setSubiendo] = useState(false)
    const [errorComprobante, setErrorComprobante] = useState<string | null>(null)
    // El pedido cuyo comprobante ya se entregó: el aviso se quita sin esperar a que Mis compras recargue.
    const [entregado, setEntregado] = useState<number | null>(null)
    const pendienteDeComprobante = esperando && esperando.id !== entregado ? esperando : null

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

    const entregarComprobante = async (archivo: File | undefined) => {
        if (!archivo || !pendienteDeComprobante || subiendo) return
        setSubiendo(true)
        setErrorComprobante(null)
        const error = await enviarComprobante(pendienteDeComprobante.id, archivo)
        setSubiendo(false)
        setErrorComprobante(error)
        if (error) return
        setEntregado(pendienteDeComprobante.id)
        onComprobante()
        await cargar()
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Chat con el asesor">
            <div className="flex flex-col gap-3">
                <p className="text-xs text-secondary">Escríbenos por aquí (también puedes enviar una imagen, un PDF o una nota de voz): el asesor recibe tu mensaje al instante y te responde en este chat.</p>

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
                                    {m.adjunto_tipo && <ChatAdjunto tipo={m.adjunto_tipo} url={m.adjunto_url} guardarQr={m.adjunto_bucket === "llaves-qr"} />}
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
                {pendienteDeComprobante && (
                    <div className="flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-amber-100">
                            Pedido #{pendienteDeComprobante.id}: cuando pagues <b>{formatCOP(pendienteDeComprobante.total)}</b>, envíanos la captura o el PDF del comprobante.
                        </p>
                        <input
                            ref={comprobanteRef}
                            type="file"
                            accept={COMPROBANTE_ACCEPT}
                            className="hidden"
                            onChange={(e) => {
                                const archivo = e.target.files?.[0]
                                e.target.value = ""
                                void entregarComprobante(archivo)
                            }}
                        />
                        <Button size="sm" className="shrink-0 self-start sm:self-auto" isLoading={subiendo} disabled={subiendo} onClick={() => comprobanteRef.current?.click()} leftIcon={<FileUp className="h-4 w-4" />}>
                            Enviar comprobante
                        </Button>
                    </div>
                )}
                {errorComprobante && <Alert variant="error" message={errorComprobante} />}
                <ChatCompositor
                    etiqueta="Mensaje para el asesor"
                    placeholder="Escribe tu mensaje…"
                    onEnviar={enviar}
                    desviarArchivo={pendienteDeComprobante && { accept: COMPROBANTE_ACCEPT, enviar: (archivo) => void entregarComprobante(archivo) }}
                    encabezado={
                        <>
                            {pendienteDeComprobante && (
                                <p className="px-1 text-xs text-amber-200/90">La imagen o PDF que envíes será el comprobante del pedido #{pendienteDeComprobante.id}.</p>
                            )}
                            {pedidoId !== null && (
                                <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-white/10 bg-white/5 py-0.5 pl-2.5 pr-1 text-xs text-white/80">
                                    Sobre el pedido #{pedidoId}
                                    <button type="button" onClick={onQuitarPedido} className="rounded-full p-0.5 hover:bg-white/10" aria-label="Quitar el pedido del mensaje">
                                        <X className="h-3 w-3" aria-hidden="true" />
                                    </button>
                                </span>
                            )}
                        </>
                    }
                />
            </div>
        </Modal>
    )
}
