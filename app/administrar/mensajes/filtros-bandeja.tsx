"use client"

import { useId, useRef, useState } from "react"
import { ArrowLeft, Folders, ListFilter, Settings2, Tags, X } from "lucide-react"
import Popover, { ITEM_POPOVER } from "@ui/popover"
import { SearchInput, SkeletonBar } from "@ui/data-frame"
import { useBandeja } from "@/app/administrar/mensajes/bandeja-contexto"
import { enPestana, tieneNoLeido, type Pestana } from "@/app/administrar/mensajes/bandeja-util"

interface FiltrosProps {
    cargando: boolean
    busqueda: string
    onBusqueda: (v: string) => void
    pestana: Pestana
    onPestana: (p: Pestana) => void
    etiquetasFiltro: number[]
    onEtiquetasFiltro: (ids: number[]) => void
    archivados: boolean
    onSalirArchivados: () => void
    /** id de la lista que controlan las pestañas. */
    listaId: string
}

const BOTON_ICONO =
    "relative grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl border border-white/10 bg-white/3 text-secondary transition-colors hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 aria-expanded:bg-white/8 aria-expanded:text-white"

/** Buscador, filtro por etiquetas, ajustes (gestores) y pestañas de carpetas (como Telegram). */
export default function FiltrosBandeja(props: Readonly<FiltrosProps>) {
    const { cargando, busqueda, onBusqueda, pestana, onPestana, etiquetasFiltro, onEtiquetasFiltro, archivados, onSalirArchivados, listaId } = props
    const { conversaciones, etiquetas, carpetas, abrirGestor } = useBandeja()
    const [verEtiquetas, setVerEtiquetas] = useState(false)
    const [ajustes, setAjustes] = useState<HTMLButtonElement | null>(null)
    const chipsId = useId()
    const tabsRef = useRef<HTMLDivElement>(null)

    const pestanas: { valor: Pestana; nombre: string; icono?: string | null }[] = [
        { valor: "todos", nombre: "Todos" },
        ...carpetas.map((c) => ({ valor: c.id, nombre: c.nombre, icono: c.icono })),
        { valor: "no-leidos", nombre: "No leídos" },
    ]
    // Chats con algo sin leer en cada pestaña (sin archivados), como el número de las carpetas de Telegram.
    const noLeidosEn = (p: Pestana) => conversaciones.filter((c) => tieneNoLeido(c) && enPestana(c, p)).length
    const archivadosN = conversaciones.filter((c) => c.archivadoEn).length
    const chipsVisibles = !cargando && (verEtiquetas || etiquetasFiltro.length > 0)

    // Pestañas: ←/→ recorren y eligen (patrón de pestañas con activación automática).
    const onTeclaTabs = (e: React.KeyboardEvent) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return
        e.preventDefault()
        const i = pestanas.findIndex((p) => p.valor === pestana)
        const n = pestanas.length
        const j = e.key === "Home" ? 0 : e.key === "End" ? n - 1 : e.key === "ArrowRight" ? (i + 1) % n : (i - 1 + n) % n
        onPestana(pestanas[j].valor)
        tabsRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[j]?.focus()
    }

    const alternarEtiqueta = (id: number) =>
        onEtiquetasFiltro(etiquetasFiltro.includes(id) ? etiquetasFiltro.filter((x) => x !== id) : [...etiquetasFiltro, id])

    return (
        <div className="flex shrink-0 flex-col gap-2.5">
            <div className="flex items-center gap-2">
                <SearchInput value={busqueda} onChange={onBusqueda} placeholder="Buscar cliente..." className="min-w-0 flex-1" />
                <button
                    type="button"
                    className={BOTON_ICONO}
                    aria-expanded={chipsVisibles}
                    aria-controls={chipsId}
                    aria-label={etiquetasFiltro.length ? `Filtrar por etiqueta (${etiquetasFiltro.length} elegidas)` : "Filtrar por etiqueta"}
                    title="Filtrar por etiqueta"
                    disabled={cargando}
                    onClick={() => {
                        // Cerrar el filtro también lo limpia: no queda un filtro activo escondido.
                        if (chipsVisibles) onEtiquetasFiltro([])
                        setVerEtiquetas(!chipsVisibles)
                    }}
                >
                    <ListFilter className="h-4 w-4" aria-hidden="true" />
                    {etiquetasFiltro.length > 0 && (
                        <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white" aria-hidden="true">
                            {etiquetasFiltro.length}
                        </span>
                    )}
                </button>
                <button
                    type="button"
                    className={BOTON_ICONO}
                    aria-expanded={ajustes !== null}
                    aria-haspopup="dialog"
                    aria-label="Etiquetas y carpetas"
                    title="Etiquetas y carpetas"
                    disabled={cargando}
                    onClick={(e) => setAjustes(ajustes ? null : e.currentTarget)}
                >
                    <Settings2 className="h-4 w-4" aria-hidden="true" />
                </button>
                {ajustes && (
                    <Popover ancla={ajustes} disparador={ajustes} onCerrar={() => setAjustes(null)} etiqueta="Etiquetas y carpetas" alinear="fin" className="w-56">
                        {(["etiquetas", "carpetas"] as const).map((g) => (
                            <button
                                key={g}
                                type="button"
                                className={ITEM_POPOVER}
                                onClick={() => {
                                    // El foco vuelve al engranaje: el modal se lo devuelve al cerrarse.
                                    ajustes.focus({ preventScroll: true })
                                    setAjustes(null)
                                    abrirGestor(g)
                                }}
                            >
                                {g === "etiquetas" ? <Tags className="h-4 w-4 text-secondary" aria-hidden="true" /> : <Folders className="h-4 w-4 text-secondary" aria-hidden="true" />}
                                <span className="flex-1">{g === "etiquetas" ? "Etiquetas" : "Carpetas"}</span>
                                <span className="text-xs tabular-nums text-secondary">{g === "etiquetas" ? etiquetas.length : carpetas.length}</span>
                            </button>
                        ))}
                    </Popover>
                )}
            </div>

            {/* Alto fijo (h-8): pestañas, la barra de archivados y su carga miden lo mismo. */}
            {cargando ? (
                <div className="flex h-8 gap-1.5" aria-hidden="true">
                    <SkeletonBar className="h-8 w-16 rounded-full!" />
                    <SkeletonBar className="h-8 w-24 rounded-full!" />
                    <SkeletonBar className="h-8 w-20 rounded-full!" />
                </div>
            ) : archivados ? (
                <div className="flex h-8 items-center gap-1.5">
                    <button
                        type="button"
                        onClick={onSalirArchivados}
                        className="-ml-1 flex h-8 items-center gap-1.5 rounded-full pr-3 pl-2 text-sm font-medium text-white hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                        aria-label="Volver a los chats"
                    >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        Archivados
                    </button>
                    <span className="text-xs tabular-nums text-secondary">{archivadosN}</span>
                </div>
            ) : (
                <div
                    ref={tabsRef}
                    role="tablist"
                    aria-label="Carpetas de chats"
                    onKeyDown={onTeclaTabs}
                    className="-mx-1 flex h-8 gap-1 overflow-x-auto overscroll-x-contain px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                    {pestanas.map((p) => {
                        const activa = p.valor === pestana
                        const n = noLeidosEn(p.valor)
                        return (
                            <button
                                key={String(p.valor)}
                                type="button"
                                role="tab"
                                aria-selected={activa}
                                aria-controls={listaId}
                                tabIndex={activa ? 0 : -1}
                                onClick={() => onPestana(p.valor)}
                                className={`relative flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                                    activa ? "bg-accent/20 text-white ring-1 ring-accent/40" : "text-secondary hover:bg-white/6 hover:text-white"
                                }`}
                            >
                                {p.icono && <span aria-hidden="true">{p.icono}</span>}
                                {p.nombre}
                                {n > 0 && (
                                    <span className={`min-w-4 rounded-full px-1 text-[10px] leading-4 font-semibold tabular-nums ${activa ? "bg-accent text-white" : "bg-white/12 text-white/85"}`}>
                                        <span className="sr-only">, chats sin leer: </span>
                                        {n}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>
            )}

            {chipsVisibles && (
                <div id={chipsId} role="group" aria-label="Filtrar por etiqueta" className="-mx-1 flex min-h-8 items-center gap-1.5 overflow-x-auto overscroll-x-contain px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {etiquetas.length === 0 ? (
                        <span className="flex items-center gap-2 text-xs text-secondary">
                            Aún no hay etiquetas.
                            <button type="button" onClick={() => abrirGestor("etiquetas")} className="rounded-md font-medium text-accent-hover underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50">
                                Crear etiquetas
                            </button>
                        </span>
                    ) : (
                        <>
                            {etiquetas.map((e) => {
                                const activa = etiquetasFiltro.includes(e.id)
                                return (
                                    <button
                                        key={e.id}
                                        type="button"
                                        aria-pressed={activa}
                                        onClick={() => alternarEtiqueta(e.id)}
                                        className={`flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                                            activa ? "border-white/25 bg-white/12 text-white" : "border-white/8 text-secondary hover:bg-white/6 hover:text-white"
                                        }`}
                                    >
                                        <span className="h-2 w-2 rounded-full" style={{ background: e.color }} aria-hidden="true" />
                                        {e.nombre}
                                    </button>
                                )
                            })}
                            {etiquetasFiltro.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => onEtiquetasFiltro([])}
                                    className="flex h-7 shrink-0 items-center gap-1 rounded-full px-2 text-xs text-secondary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                                >
                                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                                    Limpiar
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
