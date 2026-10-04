"use client"

import { useCallback, useId, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, ChevronDown, KeyRound, MessageCircle, RefreshCw, ShoppingBag } from "lucide-react"
import Card from "@ui/card"
import Button from "@ui/button"
import Alert from "@ui/alert"
import CopyInput from "@ui/copy-input"
import { SkeletonBar } from "@ui/data-frame"
import { ESTADO_PEDIDO } from "@lib/pedido"
import { formatCOP } from "@lib/currency"
import { formatColombianDateTime } from "@lib/date"
import { accessTypeLabel, type AccessType } from "@lib/access-type"
import type { MiPedido } from "@action/tienda/get-mis-pedidos-action"
import { getAccesosPedidoAction, type AccesoPerfil } from "@action/tienda/get-accesos-pedido-action"
import ChatAsesor from "@/app/administrar/compras/chat-asesor"
import AutoRefresh from "@ui/auto-refresh"

export function EstadoPedidoBadge({ estado }: Readonly<{ estado: MiPedido["estado"] }>) {
    const e = ESTADO_PEDIDO[estado]
    return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${e.clase}`}>{e.label}</span>
}

function Campo({ label, value, secret = false, error }: Readonly<{ label: string; value: string; secret?: boolean; error?: string }>) {
    const id = useId()
    return (
        <div className="flex flex-col gap-1">
            <label htmlFor={id} className="text-xs text-secondary font-medium">{label}</label>
            <CopyInput id={id} className="bg-white/3" value={value} placeholder="--" readOnly secret={secret && value !== ""} copyLabel={`Copiar ${label.toLowerCase()}`} error={error} />
        </div>
    )
}

function Acceso({ acceso }: Readonly<{ acceso: AccesoPerfil }>) {
    return (
        <div className="flex flex-col gap-3 rounded-xl border border-white/8 bg-white/2 p-4">
            <p className="text-sm font-semibold text-white">
                {acceso.platform_nombre} · {acceso.completa ? "Cuenta completa" : `Perfil ${acceso.perfil_nombre}`}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Campo label="Correo" value={acceso.email} />
                <Campo label="Contraseña" value={acceso.clave.ok ? acceso.clave.password : ""} secret error={acceso.clave.ok ? undefined : acceso.clave.error} />
                {!acceso.completa && <Campo label="Perfil" value={acceso.perfil_nombre} />}
                {!acceso.completa && acceso.pin && <Campo label="PIN" value={acceso.pin} />}
            </div>
        </div>
    )
}

function PedidoCard({ pedido, onChat }: Readonly<{ pedido: MiPedido; onChat: (pedidoId: number) => void }>) {
    const [abierto, setAbierto] = useState(false)
    const [accesos, setAccesos] = useState<AccesoPerfil[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [cargando, startCarga] = useTransition()

    const verAccesos = () => {
        const siguiente = !abierto
        setAbierto(siguiente)
        if (!siguiente || accesos) return
        setError(null)
        startCarga(async () => {
            const res = await getAccesosPedidoAction(pedido.id).catch(() => ({ ok: false as const, error: "No se pudieron cargar los accesos. Inténtalo de nuevo." }))
            if (res.ok) setAccesos(res.accesos)
            else setError(res.error)
        })
    }

    return (
        <Card padding="p-4 sm:p-6" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-base font-semibold text-white">Pedido #{pedido.id}</p>
                    <p className="text-xs text-secondary">{formatColombianDateTime(pedido.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-white tabular-nums">{formatCOP(pedido.total)}</span>
                    <EstadoPedidoBadge estado={pedido.estado} />
                </div>
            </div>

            <ul className="flex flex-col gap-1 text-sm">
                {pedido.items.map((i) => (
                    <li key={i.profile_id} className="flex justify-between gap-3">
                        <span className="min-w-0 truncate text-secondary">
                            {i.platform_nombre} · {accessTypeLabel[i.access_type as AccessType] ?? i.access_type} · {i.perfil_nombre}
                        </span>
                        <span className="shrink-0 tabular-nums text-white/80">{formatCOP(i.precio)}</span>
                    </li>
                ))}
            </ul>

            {pedido.estado === "pendiente" && (
                <p className="text-xs text-amber-300/90">Estamos verificando tu pago. Cuando lo aprobemos verás aquí tus datos de acceso.</p>
            )}
            {pedido.estado === "rechazado" && (
                <Alert variant="error" message={`No pudimos verificar este pago${pedido.motivo_rechazo ? `: ${pedido.motivo_rechazo}` : "."} Si ya pagaste, escríbele al asesor.`} />
            )}
            {pedido.estado !== "aprobado" && (
                <Button variant="secondary" size="sm" onClick={() => onChat(pedido.id)} leftIcon={<MessageCircle className="h-4 w-4" />} className="self-start">
                    Escribir al asesor sobre este pedido
                </Button>
            )}
            {pedido.estado === "aprobado" && (
                <div className="flex flex-col gap-3">
                    <Button
                        variant="secondary"
                        onClick={verAccesos}
                        aria-expanded={abierto}
                        leftIcon={<KeyRound className="h-4 w-4" />}
                        rightIcon={<ChevronDown className={`h-4 w-4 transition-transform ${abierto ? "rotate-180" : ""}`} />}
                        className="self-start"
                    >
                        {abierto ? "Ocultar accesos" : "Ver accesos"}
                    </Button>
                    {abierto && cargando && <SkeletonBar className="h-24 w-full" />}
                    {abierto && error && <Alert variant="error" message={error} />}
                    {abierto && accesos?.map((a) => <Acceso key={a.profile_id} acceso={a} />)}
                </div>
            )}
        </Card>
    )
}

/** Acceso al chat con el asesor, con el aviso de respuestas sin leer. */
function BarraAsesor({ noLeidos, onAbrir }: Readonly<{ noLeidos: number; onAbrir: () => void }>) {
    return (
        <Card padding="p-4" className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-secondary">¿Tienes dudas con un pago o tus accesos? Escríbele al asesor.</p>
            <Button variant="secondary" onClick={onAbrir} leftIcon={<MessageCircle className="h-4 w-4" />}>
                Chat con el asesor
                {noLeidos > 0 && (
                    <span className="ml-1 rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white" aria-label={`${noLeidos} respuestas sin leer`}>
                        {noLeidos}
                    </span>
                )}
            </Button>
        </Card>
    )
}

/** undefined = cargando · null = error. */
export default function ComprasClient({ pedidos, noLeidos: noLeidosInicial = 0 }: Readonly<{ pedidos: MiPedido[] | null | undefined; noLeidos?: number }>) {
    const router = useRouter()
    const [reintentando, startReintento] = useTransition()
    const [chat, setChat] = useState<{ abierto: boolean; pedidoId: number | null }>({ abierto: false, pedidoId: null })
    const [noLeidos, setNoLeidos] = useState(noLeidosInicial)
    // La recarga automática trae un conteo nuevo del servidor: manda sobre el local.
    const [conteoServidor, setConteoServidor] = useState(noLeidosInicial)
    if (noLeidosInicial !== conteoServidor) {
        setConteoServidor(noLeidosInicial)
        setNoLeidos(noLeidosInicial)
    }
    const onLeidos = useCallback(() => setNoLeidos(0), [])
    const abrirChat = (pedidoId: number | null) => setChat({ abierto: true, pedidoId })

    const chatAsesor = (
        <ChatAsesor
            isOpen={chat.abierto}
            onClose={() => setChat((c) => ({ ...c, abierto: false }))}
            pedidoId={chat.pedidoId}
            onQuitarPedido={() => setChat((c) => ({ ...c, pedidoId: null }))}
            onLeidos={onLeidos}
        />
    )

    if (pedidos === undefined) {
        return (
            <div className="flex flex-col gap-4">
                {Array.from({ length: 2 }, (_, i) => (
                    <Card key={i} padding="p-4 sm:p-6" className="flex flex-col gap-3">
                        <SkeletonBar className="h-5 w-40" />
                        <SkeletonBar className="h-5 w-full" />
                        <SkeletonBar className="h-5 w-2/3" />
                    </Card>
                ))}
            </div>
        )
    }

    if (pedidos === null) {
        return (
            <Card padding="px-4 py-12" className="flex flex-col items-center justify-center text-center">
                <AlertCircle className="mb-3 h-7 w-7 text-red-400" aria-hidden="true" />
                <p className="text-sm text-white/70">No pudimos cargar tus compras.</p>
                <Button variant="secondary" className="mt-4" isLoading={reintentando} onClick={() => startReintento(() => router.refresh())} leftIcon={<RefreshCw className="h-4 w-4" />}>
                    Reintentar
                </Button>
            </Card>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Un pago aprobado o rechazado (también desde Telegram) y las respuestas nuevas se ven sin recargar. */}
            <AutoRefresh cadaMs={pedidos.some((p) => p.estado === "pendiente") ? 8_000 : 30_000} />
            <BarraAsesor noLeidos={noLeidos} onAbrir={() => abrirChat(null)} />
            {pedidos.length === 0 ? (
                <Card padding="px-4 py-12" className="flex flex-col items-center justify-center text-center">
                    <ShoppingBag className="mb-3 h-7 w-7 text-secondary" aria-hidden="true" />
                    <p className="text-sm text-secondary">Aún no tienes compras.</p>
                    <Link href="/administrar/tienda" className="mt-4 text-sm font-medium text-accent hover:underline">Ir a la Tienda</Link>
                </Card>
            ) : (
                pedidos.map((p) => <PedidoCard key={p.id} pedido={p} onChat={abrirChat} />)
            )}
            {chatAsesor}
        </div>
    )
}
