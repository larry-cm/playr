"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, ArrowLeft, MessageCircle, ShoppingBag } from "lucide-react"
import Card from "@ui/card"
import Alert from "@ui/alert"
import ChatAdjunto from "@ui/chat-adjunto"
import ChatCompositor from "@ui/chat-compositor"
import AutoRefresh from "@ui/auto-refresh"
import { SearchInput, SkeletonBar } from "@ui/data-frame"
import { formatCOP } from "@lib/currency"
import { formatColombianDateTime } from "@lib/date"
import { quitarTildes } from "@lib/text"
import { conservarUrls } from "@lib/chat-adjunto"
import { accessTypeLabel, type AccessType } from "@lib/access-type"
import { EstadoPedidoBadge } from "@/app/administrar/compras/compras-client"
import {
    enviarMensajeStaffAction,
    getConversacionAction,
    type ClienteChat,
    type Conversacion,
    type DetalleConversacion,
} from "@action/manager-and-admin/mensajes/mensajes-action"
import type { AdjuntoSubido } from "@action/tienda/chat-asesor-action"

/** Mientras hay una conversación abierta se buscan mensajes nuevos cada tanto. */
const CADA_MS = 5000

const nombreDe = (c: ClienteChat | null) => c?.username || c?.email || "Cliente"

/** Quién escribió una respuesta del asesor: "telegram:@x" → "@x (Telegram)", "panel:correo" → "correo". */
function firma(via: string | null): string {
    if (!via) return "Asesor"
    if (via.startsWith("telegram:")) return `${via.slice(9)} (Telegram)`
    if (via.startsWith("panel:")) return via.slice(6)
    return via
}

function ChatCliente({ clienteId, onVolver }: Readonly<{ clienteId: string; onVolver: () => void }>) {
    const [detalle, setDetalle] = useState<DetalleConversacion | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const contenidoRef = useRef<HTMLDivElement>(null)
    const ultimoId = useRef(0)
    // ¿El asesor está viendo el final? Si lo está, se queda ahí aunque cambie el tamaño (imagen que carga, compositor que crece).
    const alFinal = useRef(true)

    const cargar = useCallback(
        () =>
            getConversacionAction(clienteId)
                .catch((): DetalleConversacion => ({ ok: false, error: "No se pudo cargar la conversación." }))
                .then((res) =>
                    setDetalle((previo) => {
                        if (!res.ok) return previo?.ok ? previo : res
                        return { ...res, mensajes: conservarUrls(previo?.ok ? previo.mensajes : null, res.mensajes) }
                    }),
                ),
        [clienteId],
    )

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
        const res = await enviarMensajeStaffAction(clienteId, texto, adjunto)
        if (!res.ok) return res.error
        await cargar()
        return null
    }

    const cliente = detalle?.ok ? detalle.cliente : null

    return (
        // Alto fijo (el de la bandeja): cargar, llegar mensajes o abrir los pedidos nunca cambia su tamaño; solo la lista hace scroll.
        <Card padding="p-3 sm:p-4" className="flex h-full min-h-0 flex-col gap-3">
            {/* Encabezado de alto fijo (h-10 = nombre + correo), igual cargando que cargado. */}
            <div className="flex shrink-0 items-center gap-2 border-b border-white/8 pb-3 sm:gap-3">
                <button type="button" onClick={onVolver} className="-ml-1 rounded-lg p-2 text-secondary hover:bg-white/5 hover:text-white lg:hidden" aria-label="Volver a la lista">
                    <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <div className="flex h-10 min-w-0 flex-1 flex-col justify-center">
                    {detalle === null ? (
                        <>
                            <SkeletonBar className="h-4 w-40" />
                            <SkeletonBar className="mt-1.5 h-3 w-56 max-w-full" />
                        </>
                    ) : (
                        <>
                            <p className="truncate text-base leading-6 font-semibold text-white">{nombreDe(cliente)}</p>
                            <p className="h-4 truncate text-xs text-secondary">{[cliente?.email, cliente?.phone].filter(Boolean).join(" · ")}</p>
                        </>
                    )}
                </div>

                {/* Los pedidos se abren encima de los mensajes (no los empujan). */}
                {detalle?.ok && detalle.pedidos.length > 0 && (
                    <details className="group relative shrink-0">
                        <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-white/8 px-2.5 py-1.5 text-xs text-secondary hover:bg-white/5 hover:text-white group-open:bg-white/8 group-open:text-white [&::-webkit-details-marker]:hidden">
                            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                            <span className="hidden sm:inline">Pedidos</span>
                            <span className="tabular-nums">{detalle.pedidos.length}</span>
                        </summary>
                        <ul className="absolute right-0 top-full z-20 mt-2 flex max-h-72 w-[min(24rem,calc(100vw-3rem))] flex-col gap-2 overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-background p-3 text-sm shadow-2xl">
                            {detalle.pedidos.map((p) => (
                                <li key={p.id} className="flex flex-col gap-0.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-medium text-white">#{p.id}</span>
                                        <EstadoPedidoBadge estado={p.estado} />
                                        <span className="tabular-nums text-white/80">{formatCOP(p.total)}</span>
                                        <span className="text-xs text-secondary">{formatColombianDateTime(p.created_at)}</span>
                                    </div>
                                    <span className="text-xs text-secondary">
                                        {p.items.map((i) => `${i.platform_nombre} · ${accessTypeLabel[i.access_type as AccessType] ?? i.access_type} · ${i.perfil_nombre}`).join(" — ")}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </details>
                )}
            </div>

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
                            <div key={m.id} className={`flex max-w-[85%] flex-col gap-0.5 ${delAsesor ? "self-end items-end" : "self-start items-start"}`}>
                                <div className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm text-white ${delAsesor ? "rounded-br-md bg-accent/25" : "rounded-bl-md bg-white/8"}`}>
                                    {m.pedido_id !== null && <span className="mb-0.5 block text-[11px] font-medium text-white/60">Pedido #{m.pedido_id}</span>}
                                    {m.adjunto_tipo && <ChatAdjunto tipo={m.adjunto_tipo} url={m.adjunto_url} />}
                                    {m.texto && <span className={m.adjunto_tipo ? "mt-1 block" : undefined}>{m.texto}</span>}
                                </div>
                                <span className="px-1 text-[11px] text-secondary">
                                    {delAsesor ? firma(m.autor_via) : nombreDe(cliente)} · {formatColombianDateTime(m.created_at)}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="shrink-0">
                <ChatCompositor clienteId={clienteId} etiqueta="Respuesta al cliente" placeholder="Escribe tu respuesta…" onEnviar={enviar} />
            </div>
        </Card>
    )
}

/** undefined = cargando · null = error. */
export default function MensajesClient({ conversaciones, clienteInicial }: Readonly<{ conversaciones: Conversacion[] | null | undefined; clienteInicial: string | null }>) {
    const router = useRouter()
    const [seleccionado, setSeleccionado] = useState<string | null>(clienteInicial)
    const [busqueda, setBusqueda] = useState("")

    const visibles = useMemo(() => {
        const q = quitarTildes(busqueda.trim())
        if (!conversaciones || !q) return conversaciones ?? []
        return conversaciones.filter((c) => quitarTildes(`${c.cliente?.username ?? ""} ${c.cliente?.email ?? ""} ${c.cliente?.phone ?? ""}`).includes(q))
    }, [conversaciones, busqueda])

    const elegir = (clienteId: string | null) => {
        setSeleccionado(clienteId)
        router.replace(clienteId ? `/administrar/mensajes?cliente=${clienteId}` : "/administrar/mensajes", { scroll: false })
    }

    if (conversaciones === null) {
        return (
            <Card padding="px-4 py-12" className="flex flex-col items-center justify-center text-center">
                <AlertCircle className="mb-3 h-7 w-7 text-red-400" aria-hidden="true" />
                <p className="text-sm text-white/70">No pudimos cargar los mensajes.</p>
            </Card>
        )
    }

    return (
        // Alto fijo: lo que queda de la pantalla bajo el encabezado de la página (padding de <main> + PageHeader + gap), con un
        // mínimo para pantallas muy bajas. Lista y chat hacen scroll por dentro; nada empuja la página.
        <div className="grid h-[calc(100dvh-11.5rem)] min-h-[26rem] grid-cols-1 grid-rows-1 gap-4 sm:h-[calc(100dvh-11rem)] lg:h-[calc(100dvh-8.5rem)] lg:grid-cols-[minmax(16rem,20rem)_1fr]">
            {/* Conversaciones nuevas y sin leer aparecen solas; la conversación abierta se refresca por su cuenta. */}
            <AutoRefresh cadaMs={10_000} activo={conversaciones !== undefined} />

            <Card padding="p-3" className={`flex min-h-0 flex-col gap-3 ${seleccionado ? "hidden lg:flex" : ""}`}>
                <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar cliente..." className="w-full shrink-0" />
                <ul className="-mr-1.5 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain pr-1.5 [scrollbar-color:rgb(255_255_255/0.2)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin]">
                    {conversaciones === undefined &&
                        Array.from({ length: 4 }, (_, i) => (
                            <li key={i}><SkeletonBar className="h-14 w-full" /></li>
                        ))}
                    {conversaciones !== undefined && visibles.length === 0 && (
                        <li className="flex flex-col items-center gap-2 px-3 py-10 text-center text-secondary">
                            <MessageCircle className="h-6 w-6" aria-hidden="true" />
                            <span className="text-sm">{busqueda ? "Ningún cliente coincide." : "Aún no hay mensajes de clientes."}</span>
                        </li>
                    )}
                    {visibles.map((c) => (
                        <li key={c.cliente_id}>
                            <button
                                type="button"
                                onClick={() => elegir(c.cliente_id)}
                                aria-current={seleccionado === c.cliente_id ? "true" : undefined}
                                className={`flex w-full flex-col gap-0.5 rounded-xl px-3 py-2 text-left transition-colors ${seleccionado === c.cliente_id ? "bg-white/8" : "hover:bg-white/4"}`}
                            >
                                <span className="flex items-center justify-between gap-2">
                                    <span className={`truncate text-sm ${c.sinLeer > 0 ? "font-semibold text-white" : "text-white/90"}`}>{nombreDe(c.cliente)}</span>
                                    {c.sinLeer > 0 && (
                                        <span className="shrink-0 rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white" aria-label={`${c.sinLeer} sin leer`}>{c.sinLeer}</span>
                                    )}
                                </span>
                                <span className="truncate text-xs text-secondary">{c.ultimo.autor === "asesor" ? "Tú: " : ""}{c.ultimo.texto}</span>
                                <span className="text-[11px] text-secondary/80">{formatColombianDateTime(c.ultimo.created_at)}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </Card>

            {seleccionado ? (
                <ChatCliente key={seleccionado} clienteId={seleccionado} onVolver={() => elegir(null)} />
            ) : (
                <Card padding="px-4 py-16" className="hidden h-full flex-col items-center justify-center text-center lg:flex">
                    <MessageCircle className="mb-3 h-7 w-7 text-secondary" aria-hidden="true" />
                    <p className="text-sm text-secondary">Elige un cliente para ver su conversación.</p>
                </Card>
            )}
        </div>
    )
}
