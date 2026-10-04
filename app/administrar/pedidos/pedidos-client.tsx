"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, Check, ExternalLink, FileImage, RefreshCw, X } from "lucide-react"
import Card from "@ui/card"
import Button from "@ui/button"
import Alert from "@ui/alert"
import Input from "@ui/input"
import Modal from "@ui/modal"
import { SearchInput, SkeletonBar } from "@ui/data-frame"
import { ESTADO_PEDIDO, type EstadoPedido } from "@lib/pedido"
import { formatCOP } from "@lib/currency"
import { formatColombianDateTime } from "@lib/date"
import { formatPhoneNumber } from "@lib/phone"
import { accessTypeLabel, type AccessType } from "@lib/access-type"
import { quitarTildes } from "@lib/text"
import { EstadoPedidoBadge } from "@/app/administrar/compras/compras-client"
import { getComprobanteUrlAction, type PedidoStaff } from "@action/manager-and-admin/pedidos/get-pedidos-action"
import { revisarPedidoAction } from "@action/manager-and-admin/pedidos/revisar-pedido-action"

type Filtro = EstadoPedido | "todos"
const FILTROS: { valor: Filtro; label: string }[] = [
    { valor: "pendiente", label: ESTADO_PEDIDO.pendiente.label },
    { valor: "aprobado", label: "Aprobados" },
    { valor: "rechazado", label: "Rechazados" },
    { valor: "todos", label: "Todos" },
]

type Dialogo = { tipo: "comprobante" | "aprobar" | "rechazar"; pedido: PedidoStaff } | null

function ComprobanteModal({ pedido, onClose }: Readonly<{ pedido: PedidoStaff; onClose: () => void }>) {
    const [estado, setEstado] = useState<{ url: string; pdf: boolean } | string | null>(null)

    // Se pide al abrir: la URL firmada dura 5 minutos.
    useEffect(() => {
        let vigente = true
        getComprobanteUrlAction(pedido.id)
            .catch(() => ({ ok: false as const, error: "No se pudo abrir el comprobante." }))
            .then((res) => { if (vigente) setEstado(res.ok ? { url: res.url, pdf: res.pdf } : res.error) })
        return () => { vigente = false }
    }, [pedido.id])

    return (
        <Modal isOpen title={`Comprobante · Pedido #${pedido.id}`} onClose={onClose}>
            <div className="flex flex-col gap-3">
                <p className="text-sm text-secondary">
                    Debe ser una transferencia de <b className="text-white">{formatCOP(pedido.total)}</b> a la llave <b className="text-white">{pedido.llave_breb}</b>.
                </p>
                {estado === null && <SkeletonBar className="h-64 w-full" />}
                {typeof estado === "string" && <Alert variant="error" message={estado} />}
                {estado && typeof estado === "object" && (
                    <>
                        {!estado.pdf && (
                            // eslint-disable-next-line @next/next/no-img-element -- URL firmada y temporal de Supabase Storage
                            <img src={estado.url} alt={`Comprobante del pedido ${pedido.id}`} className="max-h-[60vh] w-full rounded-xl border border-white/8 object-contain" />
                        )}
                        <a href={estado.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-accent hover:underline">
                            Abrir en otra pestaña <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        </a>
                    </>
                )}
            </div>
        </Modal>
    )
}

function RevisarModal({ dialogo, onClose }: Readonly<{ dialogo: { tipo: "aprobar" | "rechazar"; pedido: PedidoStaff }; onClose: () => void }>) {
    const router = useRouter()
    const [motivo, setMotivo] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [guardando, startGuardar] = useTransition()
    const aprobar = dialogo.tipo === "aprobar"

    const confirmar = () => {
        setError(null)
        startGuardar(async () => {
            const res = await revisarPedidoAction(dialogo.pedido.id, dialogo.tipo, motivo).catch(() => ({ ok: false as const, error: "No se pudo guardar. Inténtalo de nuevo." }))
            if (!res.ok) {
                setError(res.error)
                router.refresh()
                return
            }
            onClose()
            router.refresh()
        })
    }

    return (
        <Modal isOpen title={`${aprobar ? "Aprobar" : "Rechazar"} pedido #${dialogo.pedido.id}`} onClose={onClose} dismissible={!guardando}>
            <div className="flex flex-col gap-4">
                <p className="text-sm text-secondary">
                    {aprobar
                        ? `Confirma que recibiste ${formatCOP(dialogo.pedido.total)} en la llave ${dialogo.pedido.llave_breb}. El cliente verá sus datos de acceso de inmediato.`
                        : "Los perfiles vuelven a la Tienda y el cliente verá el pedido como rechazado con este motivo."}
                </p>
                {!aprobar && (
                    <Input
                        label="Motivo (lo ve el cliente)"
                        placeholder="Ej: no encontramos la transferencia"
                        maxLength={300}
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                    />
                )}
                {error && <Alert variant="error" message={error} />}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button>
                    <Button
                        variant={aprobar ? "primary" : "danger"}
                        isLoading={guardando}
                        disabled={guardando}
                        onClick={confirmar}
                        leftIcon={aprobar ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    >
                        {aprobar ? "Aprobar y dar acceso" : "Rechazar pedido"}
                    </Button>
                </div>
            </div>
        </Modal>
    )
}

function PedidoStaffCard({ pedido, onDialogo }: Readonly<{ pedido: PedidoStaff; onDialogo: (d: Dialogo) => void }>) {
    return (
        <Card padding="p-4 sm:p-6" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-base font-semibold text-white">Pedido #{pedido.id}</p>
                    <p className="text-xs text-secondary">{formatColombianDateTime(pedido.created_at)}</p>
                    <p className="mt-1 truncate text-sm text-white/80">
                        {pedido.cliente?.username ?? "Cliente"}
                        {pedido.cliente?.email ? ` · ${pedido.cliente.email}` : ""}
                        {pedido.cliente?.phone ? ` · ${formatPhoneNumber(pedido.cliente.phone)}` : ""}
                    </p>
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

            {pedido.estado !== "pendiente" && (
                <p className="text-xs text-secondary">
                    {pedido.estado === "aprobado" ? "Aprobado" : "Rechazado"}
                    {pedido.revisado_at ? ` el ${formatColombianDateTime(pedido.revisado_at)}` : ""}
                    {pedido.revisado_via?.startsWith("telegram:") ? ` desde Telegram (${pedido.revisado_via.slice(9)})` : ""}
                    {pedido.motivo_rechazo ? ` · ${pedido.motivo_rechazo}` : ""}
                </p>
            )}

            <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => onDialogo({ tipo: "comprobante", pedido })} leftIcon={<FileImage className="h-4 w-4" />}>
                    Ver comprobante
                </Button>
                {pedido.estado === "pendiente" && (
                    <>
                        <Button size="sm" onClick={() => onDialogo({ tipo: "aprobar", pedido })} leftIcon={<Check className="h-4 w-4" />}>Aprobar</Button>
                        <Button variant="outline" size="sm" onClick={() => onDialogo({ tipo: "rechazar", pedido })} leftIcon={<X className="h-4 w-4" />}>Rechazar</Button>
                    </>
                )}
            </div>
        </Card>
    )
}

/** undefined = cargando · null = error. */
export default function PedidosClient({ pedidos }: Readonly<{ pedidos: PedidoStaff[] | null | undefined }>) {
    const router = useRouter()
    const [reintentando, startReintento] = useTransition()
    const [filtro, setFiltro] = useState<Filtro>("pendiente")
    const [search, setSearch] = useState("")
    const [dialogo, setDialogo] = useState<Dialogo>(null)

    const visibles = useMemo(() => {
        if (!pedidos) return []
        const term = quitarTildes(search.trim())
        return pedidos.filter((p) =>
            (filtro === "todos" || p.estado === filtro) &&
            (!term || quitarTildes(`#${p.id} ${p.cliente?.username ?? ""} ${p.cliente?.email ?? ""} ${p.cliente?.phone ?? ""}`).includes(term)))
    }, [pedidos, filtro, search])

    const cuenta = (f: Filtro) => (pedidos ?? []).filter((p) => f === "todos" || p.estado === f).length

    if (pedidos === null) {
        return (
            <Card padding="px-4 py-12" className="flex flex-col items-center justify-center text-center">
                <AlertCircle className="mb-3 h-7 w-7 text-red-400" aria-hidden="true" />
                <p className="text-sm text-white/70">No se pudieron cargar los pedidos.</p>
                <Button variant="secondary" className="mt-4" isLoading={reintentando} onClick={() => startReintento(() => router.refresh())} leftIcon={<RefreshCw className="h-4 w-4" />}>
                    Reintentar
                </Button>
            </Card>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            <Card padding="p-4" className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div role="tablist" aria-label="Estado del pedido" className="flex flex-wrap gap-2">
                    {FILTROS.map((f) => (
                        <button
                            key={f.valor}
                            type="button"
                            role="tab"
                            aria-selected={filtro === f.valor}
                            onClick={() => setFiltro(f.valor)}
                            className={`rounded-lg border px-3 py-1.5 text-sm transition ${filtro === f.valor ? "border-accent/50 bg-accent/15 text-white" : "border-white/10 text-secondary hover:text-white"}`}
                        >
                            {f.label}
                            {pedidos !== undefined && <span className="ml-1.5 tabular-nums text-xs opacity-70">{cuenta(f.valor)}</span>}
                        </button>
                    ))}
                </div>
                <SearchInput value={search} onChange={setSearch} placeholder="Buscar por cliente o número de pedido..." className="w-full lg:max-w-sm" />
            </Card>

            {pedidos === undefined ? (
                Array.from({ length: 2 }, (_, i) => (
                    <Card key={i} padding="p-4 sm:p-6" className="flex flex-col gap-3">
                        <SkeletonBar className="h-5 w-40" />
                        <SkeletonBar className="h-5 w-full" />
                        <SkeletonBar className="h-5 w-2/3" />
                    </Card>
                ))
            ) : visibles.length === 0 ? (
                <Card padding="px-4 py-12" className="text-center text-sm text-secondary">
                    {filtro === "pendiente" && !search ? "No hay pagos por verificar." : "No hay pedidos con este filtro."}
                </Card>
            ) : (
                visibles.map((p) => <PedidoStaffCard key={p.id} pedido={p} onDialogo={setDialogo} />)
            )}

            {dialogo?.tipo === "comprobante" && <ComprobanteModal pedido={dialogo.pedido} onClose={() => setDialogo(null)} />}
            {dialogo && dialogo.tipo !== "comprobante" && <RevisarModal dialogo={{ tipo: dialogo.tipo, pedido: dialogo.pedido }} onClose={() => setDialogo(null)} />}
        </div>
    )
}
