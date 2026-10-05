"use client"

import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { ArrowLeft, Check, Copy, Mail, Pin, ShoppingBag, StickyNote, Trash2, X } from "lucide-react"
import Alert from "@ui/alert"
import Button from "@ui/button"
import { SkeletonBar } from "@ui/data-frame"
import { colorAutor } from "@ui/chat-burbuja"
import { formatCOP } from "@lib/currency"
import { formatColombianDate, formatColombianDateTime } from "@lib/date"
import { accessTypeLabel, type AccessType } from "@lib/access-type"
import { largo, normalizarNotas, NOTAS_MAX, type AutorChat } from "@lib/chat-bandeja"
import { EstadoPedidoBadge } from "@/app/administrar/compras/compras-client"
import type { Conversacion, DetalleConversacion } from "@action/manager-and-admin/mensajes/mensajes-action"
import { guardarNotasAction } from "@action/manager-and-admin/mensajes/estado-action"
import { useBandeja } from "@/app/administrar/mensajes/bandeja-contexto"
import ChecklistAsignar, { opcionesCarpetas, opcionesEtiquetas } from "@/app/administrar/mensajes/checklist-asignar"
import { ConfirmarEliminarChat } from "@/app/administrar/mensajes/menu-chat"
import { inicialDe, nombreDe } from "@/app/administrar/mensajes/bandeja-util"

export type SeccionPanel = "inicio" | "pedidos"

/** Esc cancela la edición en curso sin cerrar el panel. */
const escCancela = (cancelar: () => void) => (e: React.KeyboardEvent) => {
    if (e.key !== "Escape") return
    e.preventDefault()
    cancelar()
}

function Seccion({ titulo, accion, children, id }: Readonly<{ titulo: string; accion?: ReactNode; children: ReactNode; id?: string }>) {
    return (
        <section id={id} className="flex flex-col gap-2 border-t border-white/8 px-4 py-4">
            <div className="flex min-h-7 items-center justify-between gap-2">
                <h4 className="text-xs font-semibold tracking-wide text-secondary uppercase">{titulo}</h4>
                {accion}
            </div>
            {children}
        </section>
    )
}

/** Interruptor accesible (role="switch"); con motivo, deshabilitado y explicado debajo. */
function Interruptor({ etiqueta, activo, onCambio, motivo }: Readonly<{ etiqueta: string; activo: boolean; onCambio: () => void; motivo?: string | null }>) {
    const ayudaId = useId()
    return (
        <div className="flex flex-col gap-0.5">
            <button
                type="button"
                role="switch"
                aria-checked={activo}
                aria-describedby={motivo ? ayudaId : undefined}
                disabled={Boolean(motivo)}
                onClick={onCambio}
                className="flex min-h-9 w-full items-center justify-between gap-3 rounded-lg px-1 text-left text-sm text-white/90 hover:bg-white/3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {etiqueta}
                <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${activo ? "bg-accent" : "bg-white/15"}`} aria-hidden="true">
                    <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${activo ? "translate-x-4" : ""}`} />
                </span>
            </button>
            {motivo && <p id={ayudaId} className="px-1 text-[11px] text-secondary">{motivo}</p>}
        </div>
    )
}

function BotonCopiar({ valor, que }: Readonly<{ valor: string; que: string }>) {
    const [copiado, setCopiado] = useState(false)
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    useEffect(() => () => clearTimeout(timer.current), [])
    return (
        <button
            type="button"
            onClick={() =>
                void navigator.clipboard?.writeText(valor).then(() => {
                    setCopiado(true)
                    clearTimeout(timer.current)
                    timer.current = setTimeout(() => setCopiado(false), 1500)
                })
            }
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-secondary hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            aria-label={copiado ? `${que} copiado` : `Copiar ${que}`}
            title={copiado ? "Copiado" : `Copiar ${que}`}
        >
            {copiado ? <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
        </button>
    )
}

/** Notas internas del chat (≤1000): solo las ve el equipo. */
function NotasChat({ clienteId, inicial }: Readonly<{ clienteId: string; inicial: string | null }>) {
    const [base, setBase] = useState(inicial)
    const [texto, setTexto] = useState(inicial ?? "")
    const [guardando, setGuardando] = useState(false)
    const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null)
    const id = useId()
    const n = largo(normalizarNotas(texto) ?? "")
    const largas = n > NOTAS_MAX
    const cambio = normalizarNotas(texto) !== base

    const guardar = async () => {
        setGuardando(true)
        setAviso(null)
        const r = await guardarNotasAction(clienteId, texto).catch(() => ({ ok: false as const, error: "No se pudieron guardar las notas. Inténtalo de nuevo." }))
        setGuardando(false)
        if (!r.ok) {
            setAviso({ tipo: "error", texto: r.error })
            return
        }
        setBase(r.notas)
        setTexto(r.notas ?? "")
        setAviso({ tipo: "ok", texto: "Notas guardadas." })
    }

    return (
        <div className="flex flex-col gap-2">
            <textarea
                id={id}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={4}
                placeholder="Preferencias, acuerdos, datos útiles…"
                aria-label="Notas internas"
                aria-describedby={`${id}-ayuda`}
                aria-invalid={largas || undefined}
                disabled={guardando}
                className={`w-full resize-y rounded-xl border bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-muted focus:border-accent focus:ring-1 focus:ring-accent/40 ${largas ? "border-red-500/50" : "border-white/10"}`}
            />
            <div className="flex items-center justify-between gap-2">
                <p id={`${id}-ayuda`} className={`text-[11px] ${largas ? "text-red-400" : "text-secondary"}`}>
                    {largas ? `Las notas son muy largas (máximo ${NOTAS_MAX} caracteres).` : "Solo lo ve el equipo."} <span className="tabular-nums">{n}/{NOTAS_MAX}</span>
                </p>
                <Button size="sm" variant="secondary" onClick={guardar} isLoading={guardando} disabled={!cambio || largas}>
                    Guardar
                </Button>
            </div>
            {aviso && <Alert variant={aviso.tipo === "ok" ? "success" : "error"} message={aviso.texto} onDismiss={() => setAviso(null)} autoDismissMs={aviso.tipo === "ok" ? 2500 : undefined} />}
        </div>
    )
}

interface PanelProps {
    clienteId: string
    detalle: DetalleConversacion | null
    autorDe: (autor: AutorChat) => string
    seccion: SeccionPanel
    /** Cambia con cada apertura pedida por el usuario: entonces toma el foco y va a la sección. */
    apertura: number
    debeEnfocar: (apertura: number) => boolean
    onIrA: (id: number) => void
    onCerrar: () => void
}

/** Panel de detalles del chat: cliente, estado, etiquetas, carpetas, notas, fijados, pedidos y eliminar. */
export default function PanelDetalles({ clienteId, detalle, autorDe, seccion, apertura, debeEnfocar, onIrA, onCerrar }: Readonly<PanelProps>) {
    const { conversaciones, etiquetas, carpetas, acciones, motivoNoFijar, error, cerrarError, abrirGestor } = useBandeja()
    const [editar, setEditar] = useState<"etiquetas" | "carpetas" | null>(null)
    const [confirmar, setConfirmar] = useState(false)
    const cerrarRef = useRef<HTMLButtonElement>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const pedidosId = useId()
    const tituloId = useId()

    useEffect(() => {
        if (!debeEnfocar(apertura)) return
        cerrarRef.current?.focus({ preventScroll: true })
        const lista = scrollRef.current
        const destino = seccion === "pedidos" ? document.getElementById(pedidosId) : null
        if (lista) lista.scrollTop = destino ? destino.offsetTop - lista.offsetTop : 0
    }, [apertura, seccion, debeEnfocar, pedidosId])

    const ok = detalle?.ok ? detalle : null
    const cliente = ok?.cliente ?? null
    // El estado sale de la lista (con los cambios en curso); si el chat no está en ella, del detalle.
    const c: Conversacion | null =
        conversaciones.find((x) => x.cliente_id === clienteId) ??
        (ok
            ? { cliente_id: clienteId, cliente, ultimo: { id: 0, texto: "", autor: "cliente", created_at: "" }, sinLeer: 0, fijadoEn: ok.estado.fijadoEn, archivadoEn: ok.estado.archivadoEn, noLeidoManual: ok.estado.noLeidoManual, etiquetas: ok.estado.etiquetas, carpetas: ok.estado.carpetas }
            : null)
    const nombre = nombreDe(cliente ?? c?.cliente)
    const deEstas = <T extends { id: number }>(xs: T[], ids: number[]) => xs.filter((x) => ids.includes(x.id))

    return (
        <div
            role="complementary"
            aria-labelledby={tituloId}
            onKeyDown={(e) => {
                if (e.key === "Escape" && !e.defaultPrevented) {
                    e.preventDefault()
                    onCerrar()
                }
            }}
            className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/6 bg-[#101017] shadow-2xl shadow-black/50 xl:bg-white/3 xl:shadow-none"
        >
            <div className="flex h-14 shrink-0 items-center gap-2 px-2.5">
                <button
                    ref={cerrarRef}
                    type="button"
                    onClick={onCerrar}
                    className="grid h-10 w-10 place-items-center rounded-lg text-secondary hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                    aria-label="Cerrar detalles"
                >
                    <ArrowLeft className="h-5 w-5 lg:hidden" aria-hidden="true" />
                    <X className="hidden h-5 w-5 lg:block" aria-hidden="true" />
                </button>
                <h3 id={tituloId} className="text-sm font-semibold text-white">Detalles del chat</h3>
            </div>

            <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-color:rgb(255_255_255/0.2)_transparent] [scrollbar-width:thin]">
                {/* Cliente */}
                <div className="flex flex-col items-center gap-1 px-4 pt-2 pb-4 text-center">
                    <span className="mb-1 grid h-16 w-16 place-items-center rounded-full bg-accent/20 text-2xl font-semibold text-white" aria-hidden="true">
                        {detalle === null ? "" : inicialDe(nombre)}
                    </span>
                    {detalle === null ? (
                        <>
                            <SkeletonBar className="h-5 w-36" />
                            <SkeletonBar className="h-4 w-48" />
                        </>
                    ) : (
                        <>
                            <p className="max-w-full truncate text-base font-semibold text-white">{nombre}</p>
                            {cliente?.email && (
                                <span className="flex max-w-full items-center gap-1 text-xs text-secondary">
                                    <span className="truncate">{cliente.email}</span>
                                    <BotonCopiar valor={cliente.email} que="correo" />
                                </span>
                            )}
                            {cliente?.phone && (
                                <span className="-mt-1 flex items-center gap-1 text-xs text-secondary">
                                    <span className="tabular-nums">{cliente.phone}</span>
                                    <BotonCopiar valor={cliente.phone} que="teléfono" />
                                </span>
                            )}
                            {ok?.clienteDesde && <p className="text-[11px] text-secondary/80">Cliente desde {formatColombianDate(ok.clienteDesde)}</p>}
                        </>
                    )}
                </div>

                {error?.origen === "panel" && (
                    <div className="px-4 pb-3">
                        <Alert variant="error" message={error.texto} onDismiss={cerrarError} />
                    </div>
                )}

                {c && (
                    <>
                        <Seccion titulo="Estado">
                            <Interruptor etiqueta="Fijar chat" activo={Boolean(c.fijadoEn)} motivo={motivoNoFijar(c)} onCambio={() => acciones.fijar(c, !c.fijadoEn, "panel")} />
                            <Interruptor etiqueta="Archivar chat" activo={Boolean(c.archivadoEn)} onCambio={() => acciones.archivar(c, !c.archivadoEn, "panel")} />
                            <button
                                type="button"
                                onClick={() => acciones.marcarNoLeido(c, "panel")}
                                className="flex min-h-9 w-full items-center gap-2 rounded-lg px-1 text-left text-sm text-white/90 hover:bg-white/3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                            >
                                <Mail className="h-4 w-4 text-secondary" aria-hidden="true" />
                                <span className="flex flex-col">
                                    Marcar como no leído
                                    <span className="text-[11px] text-secondary">Cierra el chat y queda marcado en la lista.</span>
                                </span>
                            </button>
                        </Seccion>

                        <Seccion
                            titulo="Etiquetas"
                            accion={editar !== "etiquetas" && <Button variant="ghost" size="sm" onClick={() => setEditar("etiquetas")}>Editar</Button>}
                        >
                            {editar === "etiquetas" ? (
                                <div className="rounded-xl border border-white/10 bg-[#16161f] p-1.5" onKeyDown={escCancela(() => setEditar(null))}>
                                    <ChecklistAsignar
                                        titulo="Etiquetas del chat"
                                        opciones={opcionesEtiquetas(etiquetas)}
                                        inicial={c.etiquetas}
                                        onAplicar={(ids) => acciones.asignarEtiquetas(c, ids, "panel")}
                                        onCancelar={() => setEditar(null)}
                                        vacio={<Button variant="secondary" size="sm" onClick={() => abrirGestor("etiquetas")}>Crear etiquetas</Button>}
                                    />
                                </div>
                            ) : deEstas(etiquetas, c.etiquetas).length === 0 ? (
                                <p className="text-sm text-secondary">Sin etiquetas.</p>
                            ) : (
                                <ul className="flex flex-wrap gap-1.5">
                                    {deEstas(etiquetas, c.etiquetas).map((e) => (
                                        <li key={e.id} className="flex items-center gap-1.5 rounded-full bg-white/6 px-2.5 py-1 text-xs text-white/85">
                                            <span className="h-2 w-2 rounded-full" style={{ background: e.color }} aria-hidden="true" />
                                            {e.nombre}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Seccion>

                        <Seccion
                            titulo="Carpetas"
                            accion={editar !== "carpetas" && <Button variant="ghost" size="sm" onClick={() => setEditar("carpetas")}>Editar</Button>}
                        >
                            {editar === "carpetas" ? (
                                <div className="rounded-xl border border-white/10 bg-[#16161f] p-1.5" onKeyDown={escCancela(() => setEditar(null))}>
                                    <ChecklistAsignar
                                        titulo="Carpetas del chat"
                                        opciones={opcionesCarpetas(carpetas)}
                                        inicial={c.carpetas}
                                        onAplicar={(ids) => acciones.asignarCarpetas(c, ids, "panel")}
                                        onCancelar={() => setEditar(null)}
                                        vacio={<Button variant="secondary" size="sm" onClick={() => abrirGestor("carpetas")}>Crear carpetas</Button>}
                                    />
                                </div>
                            ) : deEstas(carpetas, c.carpetas).length === 0 ? (
                                <p className="text-sm text-secondary">En ninguna carpeta.</p>
                            ) : (
                                <ul className="flex flex-wrap gap-1.5">
                                    {deEstas(carpetas, c.carpetas).map((f) => (
                                        <li key={f.id} className="flex items-center gap-1.5 rounded-full bg-white/6 px-2.5 py-1 text-xs text-white/85">
                                            {f.icono && <span aria-hidden="true">{f.icono}</span>}
                                            {f.nombre}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Seccion>
                    </>
                )}

                <Seccion titulo="Notas internas" accion={<StickyNote className="h-4 w-4 text-secondary" aria-hidden="true" />}>
                    {ok ? <NotasChat key={clienteId} clienteId={clienteId} inicial={ok.estado.notas} /> : <SkeletonBar className="h-24 w-full" />}
                </Seccion>

                <Seccion titulo="Mensajes fijados" accion={<Pin className="h-4 w-4 text-secondary" aria-hidden="true" />}>
                    {!ok || ok.fijados.length === 0 ? (
                        <p className="text-sm text-secondary">{ok ? "Ningún mensaje fijado." : "…"}</p>
                    ) : (
                        <ul className="flex flex-col gap-1">
                            {ok.fijados.map((f) => (
                                <li key={f.id}>
                                    <button
                                        type="button"
                                        onClick={() => onIrA(f.id)}
                                        className={`w-full rounded-lg border-l-2 bg-white/3 px-2.5 py-1.5 text-left hover:bg-white/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${colorAutor(f.autor)}`}
                                    >
                                        <span className="block text-[11px] font-semibold">{autorDe(f.autor)}</span>
                                        <span className="line-clamp-2 text-xs text-white/80">{f.texto}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </Seccion>

                <Seccion id={pedidosId} titulo={ok ? `Pedidos (${ok.pedidos.length})` : "Pedidos"} accion={<ShoppingBag className="h-4 w-4 text-secondary" aria-hidden="true" />}>
                    {!ok || ok.pedidos.length === 0 ? (
                        <p className="text-sm text-secondary">{ok ? "Este cliente aún no tiene pedidos." : "…"}</p>
                    ) : (
                        <ul className="flex flex-col gap-2.5 text-sm">
                            {ok.pedidos.map((p) => (
                                <li key={p.id} className="flex flex-col gap-0.5 rounded-xl bg-white/3 px-3 py-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-medium text-white">#{p.id}</span>
                                        <EstadoPedidoBadge estado={p.estado} />
                                        <span className="ml-auto tabular-nums text-white/80">{formatCOP(p.total)}</span>
                                    </div>
                                    <span className="text-[11px] text-secondary">{formatColombianDateTime(p.created_at)}</span>
                                    <span className="text-xs text-secondary">
                                        {p.items.map((i) => `${i.platform_nombre} · ${accessTypeLabel[i.access_type as AccessType] ?? i.access_type} · ${i.perfil_nombre}`).join(" — ")}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Seccion>

                {c && (
                    <Seccion titulo="Zona de peligro">
                        {confirmar ? (
                            <div className="rounded-xl border border-red-500/20 bg-red-500/5" onKeyDown={escCancela(() => setConfirmar(false))}>
                                <ConfirmarEliminarChat onCancelar={() => setConfirmar(false)} onConfirmar={() => acciones.eliminar(c, "panel")} />
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setConfirmar(true)}
                                className="flex items-center gap-1.5 self-start rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
                            >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                Eliminar chat
                            </button>
                        )}
                    </Seccion>
                )}
            </div>
        </div>
    )
}
