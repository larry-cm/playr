"use client"

import { useMemo, type ReactNode } from "react"
import { Check, LayoutGrid, Monitor, SlidersHorizontal, Users, X, type LucideIcon } from "lucide-react"
import { formatCOP } from "@lib/currency"
import { marca } from "@lib/marcas"
import PlatformEmblem from "@ui/platform-emblem"
import { SkeletonBar } from "@ui/data-frame"
import type { CatalogoDisponibleItem } from "@action/tienda/get-catalogo-disponible-action"

/** Pantallas o cuentas completas; "" = todo (incluye los productos que no son ni una ni otra). */
export type TipoFiltro = "" | "pantalla" | "completa"

export interface FiltroTienda {
    /** Plataformas elegidas (platform_nombre). Vacío = todas. */
    plataformas: string[]
    tipo: TipoFiltro
    /** Rango de precio elegido [mín, máx]. null = sin límite (todo el rango del catálogo). */
    precio: [number, number] | null
}

export const SIN_FILTRO: FiltroTienda = { plataformas: [], tipo: "", precio: null }

type Clave = keyof FiltroTienda

/** Si un producto pasa el filtro. `salvo` ignora un criterio: así cada control cuenta lo que quedaría con los otros ya aplicados. */
export function pasaFiltroTienda(item: CatalogoDisponibleItem, f: FiltroTienda, salvo?: Clave) {
    if (salvo !== "plataformas" && f.plataformas.length > 0 && !f.plataformas.includes(item.platform_nombre)) return false
    if (salvo !== "tipo" && f.tipo && item.access_type !== f.tipo) return false
    if (salvo !== "precio" && f.precio && (item.precio_venta < f.precio[0] || item.precio_venta > f.precio[1])) return false
    return true
}

export const hayFiltro = (f: FiltroTienda) => f.plataformas.length > 0 || f.tipo !== "" || f.precio !== null

/** `corto` va en el control segmentado de móvil; `label` y `detalle`, en el panel de escritorio. */
const TIPOS: { value: TipoFiltro; corto: string; label: string; detalle: string; icon: LucideIcon }[] = [
    { value: "", corto: "Todo", label: "Todo", detalle: "Pantallas y cuentas", icon: LayoutGrid },
    { value: "pantalla", corto: "Pantallas", label: "Pantallas", detalle: "Un perfil para ti", icon: Monitor },
    { value: "completa", corto: "Cuentas", label: "Cuentas completas", detalle: "Todos los perfiles", icon: Users },
]

/** Paso del deslizador de precio (COP). Los precios del catálogo son redondos a miles. */
const PASO = 1000

export interface TiendaFiltrosProps {
    /** Catálogo completo: de él salen las plataformas y los límites del precio. undefined = aún carga. */
    todos: CatalogoDisponibleItem[] | undefined
    /** Productos que pasan el buscador: sobre ellos se cuentan las opciones. */
    base: CatalogoDisponibleItem[]
    /** Cuántos productos se muestran con todos los filtros aplicados. */
    visibles: number
    value: FiltroTienda
    onChange: (value: FiltroTienda) => void
}

/** Opciones de cada filtro con cuántos productos quedarían si se eligen (con los otros filtros ya aplicados). */
function useOpciones({ todos, base, value }: Pick<TiendaFiltrosProps, "todos" | "base" | "value">) {
    const plataformas = useMemo(() => {
        if (!todos) return []
        const nombres = [...new Set(todos.map((item) => item.platform_nombre))]
        return nombres.sort((a, b) => marca(a).nombre.localeCompare(marca(b).nombre, "es"))
    }, [todos])

    const limites = useMemo<[number, number] | null>(() => {
        if (!todos || todos.length === 0) return null
        const precios = todos.map((item) => item.precio_venta)
        return [Math.floor(Math.min(...precios) / PASO) * PASO, Math.ceil(Math.max(...precios) / PASO) * PASO]
    }, [todos])

    const conteo = (clave: Clave, pasa: (item: CatalogoDisponibleItem) => boolean) =>
        base.filter((item) => pasaFiltroTienda(item, value, clave) && pasa(item)).length

    return {
        cargando: todos === undefined,
        limites,
        tipos: TIPOS.map((t) => ({ ...t, n: conteo("tipo", (item) => !t.value || item.access_type === t.value) })),
        plataformas: plataformas.map((p) => ({ p, n: conteo("plataformas", (item) => item.platform_nombre === p) })),
    }
}

const alternar = (value: FiltroTienda, p: string): FiltroTienda => ({
    ...value,
    plataformas: value.plataformas.includes(p) ? value.plataformas.filter((x) => x !== p) : [...value.plataformas, p],
})

/** Logo de la plataforma o, si la marca no tiene logo (su emblema de texto repetiría el nombre), un punto de su color. */
function MarcaIcono({ platform, size = 16 }: Readonly<{ platform: string; size?: number }>) {
    const { logo, color } = marca(platform)
    if (logo) return <PlatformEmblem platform={platform} size={size} />
    return <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
}

const cantidad = (n: number) => `${n} ${n === 1 ? "producto" : "productos"}`

const BOTON_LIMPIAR =
    "inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/3 px-3 py-2 text-sm text-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"

/* ─────────────────────────────── Móvil y tablet ─────────────────────────────── */

/**
 * Filtros compactos (debajo de xl): tipo en un control segmentado, plataformas en una fila que se desliza para no empujar
 * los productos hacia abajo, y el rango de precio.
 */
export function FiltrosCompactos({ todos, base, visibles, value, onChange }: Readonly<TiendaFiltrosProps>) {
    const { cargando, limites, tipos, plataformas } = useOpciones({ todos, base, value })

    return (
        <div className="flex flex-col gap-4">
            {/* Tipo: mismo control segmentado que el selector de rango del Dashboard. */}
            <div role="radiogroup" aria-label="Tipo de producto" className="flex rounded-xl border border-white/6 bg-white/3 p-1 sm:w-fit">
                {tipos.map((t) => {
                    const elegido = value.tipo === t.value
                    return (
                        <button
                            key={t.value}
                            type="button"
                            role="radio"
                            aria-checked={elegido}
                            onClick={() => onChange({ ...value, tipo: t.value })}
                            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${elegido ? "bg-accent/15 text-accent" : "text-secondary hover:text-white"}`}
                        >
                            {t.corto}
                            {!cargando && <span className={`text-xs tabular-nums ${elegido ? "text-accent/70" : "text-muted"}`}>{t.n}</span>}
                        </button>
                    )
                })}
            </div>

            {/* contain:inline-size: la fila no ensancha la página aunque un contenedor mida por contenido. */}
            <div
                role="group"
                aria-label="Plataformas"
                className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [contain:inline-size] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden"
            >
                {cargando ? (
                    Array.from({ length: 5 }, (_, i) => <SkeletonBar key={i} className="h-9! w-28 shrink-0 rounded-full!" />)
                ) : (
                    <>
                        <Chip elegido={value.plataformas.length === 0} onClick={() => onChange({ ...value, plataformas: [] })}>
                            Todas
                        </Chip>
                        {plataformas.map(({ p, n }) => {
                            const elegido = value.plataformas.includes(p)
                            return (
                                <Chip key={p} elegido={elegido} apagado={n === 0 && !elegido} onClick={() => onChange(alternar(value, p))}>
                                    <MarcaIcono platform={p} />
                                    {marca(p).nombre}
                                    <span className={`text-xs tabular-nums ${elegido ? "text-accent/70" : "text-muted"}`}>{n}</span>
                                </Chip>
                            )
                        })}
                    </>
                )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
                <div className="w-full sm:max-w-xs">
                    <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
                        <span className="text-secondary">Precio</span>
                        <RangoTexto limites={limites} value={value.precio} />
                    </div>
                    <RangoPrecio limites={limites} value={value.precio} onChange={(precio) => onChange({ ...value, precio })} />
                </div>

                <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <div aria-live="polite" className="text-sm text-secondary">
                        {cargando ? <SkeletonBar className="w-24" /> : cantidad(visibles)}
                    </div>
                    {hayFiltro(value) && (
                        <button type="button" onClick={() => onChange(SIN_FILTRO)} className={BOTON_LIMPIAR}>
                            <X className="h-4 w-4" />
                            Limpiar filtros
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

function Chip({ elegido, apagado, onClick, children }: Readonly<{ elegido: boolean; apagado?: boolean; onClick: () => void; children: ReactNode }>) {
    return (
        <button
            type="button"
            aria-pressed={elegido}
            onClick={onClick}
            className={`inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 ${elegido
                ? "border-accent/30 bg-accent/10 text-accent"
                : "border-white/10 text-secondary hover:bg-white/5 hover:text-white"
                } ${apagado ? "opacity-40" : ""}`}
        >
            {children}
        </button>
    )
}

/* ─────────────────────────────── Escritorio ─────────────────────────────── */

/**
 * Panel lateral de filtros (desde xl): una sección por criterio, con lo que significa cada tipo, la lista de plataformas con su
 * logo y el rango de precio con sus extremos a la vista. Los conteos dicen cuántos productos quedarían al elegir cada opción.
 */
export function FiltrosPanel({ todos, base, value, onChange }: Readonly<Omit<TiendaFiltrosProps, "visibles">>) {
    const { cargando, limites, tipos, plataformas } = useOpciones({ todos, base, value })

    return (
        <div className="flex flex-col">
            <div className="flex items-center justify-between gap-3 pb-4">
                <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                    <SlidersHorizontal className="h-4 w-4 text-accent" />
                    Filtros
                </h2>
                {hayFiltro(value) && (
                    <button
                        type="button"
                        onClick={() => onChange(SIN_FILTRO)}
                        className="rounded-md text-xs font-medium text-accent transition-colors hover:text-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
                    >
                        Limpiar todo
                    </button>
                )}
            </div>

            <Seccion titulo="Tipo de acceso">
                <div role="radiogroup" aria-label="Tipo de acceso" className="flex flex-col gap-2">
                    {tipos.map((t) => {
                        const elegido = value.tipo === t.value
                        const Icon = t.icon
                        return (
                            <button
                                key={t.value}
                                type="button"
                                role="radio"
                                aria-checked={elegido}
                                onClick={() => onChange({ ...value, tipo: t.value })}
                                className={`group flex items-center gap-3 rounded-xl border p-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 ${elegido
                                    ? "border-accent/40 bg-accent/10"
                                    : "border-white/6 bg-white/2 hover:border-white/12 hover:bg-white/4"
                                    }`}
                            >
                                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${elegido ? "bg-accent/20 text-accent" : "bg-white/5 text-secondary group-hover:text-white"}`}>
                                    <Icon className="h-4 w-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className={`block text-sm font-medium ${elegido ? "text-white" : "text-foreground"}`}>{t.label}</span>
                                    <span className="block truncate text-xs text-muted">{t.detalle}</span>
                                </span>
                                {cargando ? <SkeletonBar className="w-5" /> : <Conteo n={t.n} elegido={elegido} />}
                            </button>
                        )
                    })}
                </div>
            </Seccion>

            <Seccion titulo="Precio">
                <RangoPrecio limites={limites} value={value.precio} onChange={(precio) => onChange({ ...value, precio })} />
                <div className="mt-3 grid grid-cols-2 gap-2">
                    {(["Desde", "Hasta"] as const).map((etiqueta, i) => (
                        <div key={etiqueta} className="rounded-xl border border-white/6 bg-white/2 px-3 py-2">
                            <span className="block text-[11px] uppercase tracking-wide text-muted">{etiqueta}</span>
                            {limites ? (
                                <span className="block text-sm font-semibold tabular-nums text-white">{formatCOP((value.precio ?? limites)[i])}</span>
                            ) : (
                                <SkeletonBar className="mt-0.5 w-16" />
                            )}
                        </div>
                    ))}
                </div>
            </Seccion>

            <Seccion
                titulo="Plataformas"
                ultima
                accion={value.plataformas.length > 0 ? { label: `Quitar (${value.plataformas.length})`, onClick: () => onChange({ ...value, plataformas: [] }) } : undefined}
            >
                <div role="group" aria-label="Plataformas" className="-mx-1 flex max-h-60 flex-col gap-0.5 overflow-y-auto px-1 [scrollbar-width:thin]">
                    {cargando
                        ? Array.from({ length: 6 }, (_, i) => <SkeletonBar key={i} className="my-2 w-full" />)
                        : plataformas.map(({ p, n }) => {
                            const elegido = value.plataformas.includes(p)
                            return (
                                <button
                                    key={p}
                                    type="button"
                                    aria-pressed={elegido}
                                    onClick={() => onChange(alternar(value, p))}
                                    className={`flex items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 ${elegido ? "bg-accent/10 text-white" : "text-foreground hover:bg-white/4"} ${n === 0 && !elegido ? "opacity-40" : ""}`}
                                >
                                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${elegido ? "border-accent bg-accent text-white" : "border-white/20"}`} aria-hidden="true">
                                        {elegido && <Check className="h-3 w-3" strokeWidth={3} />}
                                    </span>
                                    <span className="flex w-5 shrink-0 justify-center"><MarcaIcono platform={p} size={18} /></span>
                                    <span className="min-w-0 flex-1 truncate">{marca(p).nombre}</span>
                                    <Conteo n={n} elegido={elegido} />
                                </button>
                            )
                        })}
                </div>
            </Seccion>
        </div>
    )
}

function Seccion({ titulo, accion, ultima, children }: Readonly<{ titulo: string; accion?: { label: string; onClick: () => void }; ultima?: boolean; children: ReactNode }>) {
    return (
        <section className={`border-t border-white/6 pt-4 ${ultima ? "" : "pb-5"}`}>
            <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-secondary">{titulo}</h3>
                {accion && (
                    <button type="button" onClick={accion.onClick} className="rounded-md text-xs text-muted transition-colors hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25">
                        {accion.label}
                    </button>
                )}
            </div>
            {children}
        </section>
    )
}

function Conteo({ n, elegido }: Readonly<{ n: number; elegido: boolean }>) {
    return (
        <span className={`min-w-6 shrink-0 rounded-md px-1.5 py-0.5 text-center text-xs tabular-nums ${elegido ? "bg-accent/20 text-accent" : "bg-white/5 text-muted"}`}>
            {n}
        </span>
    )
}

/**
 * Barra sobre los productos (desde xl): cuántos hay y los filtros activos como pastillas que se quitan de a una,
 * así el cliente ve de un vistazo por qué ve lo que ve.
 */
export function FiltrosActivos({ todos, visibles, value, onChange }: Readonly<Pick<TiendaFiltrosProps, "todos" | "visibles" | "value" | "onChange">>) {
    const tipo = TIPOS.find((t) => t.value === value.tipo)

    return (
        <div className="flex min-h-9 flex-wrap items-center gap-2">
            <span aria-live="polite" className="mr-1 text-sm text-secondary">
                {todos === undefined ? <SkeletonBar className="w-24" /> : <><span className="font-semibold text-white">{visibles}</span> {visibles === 1 ? "producto" : "productos"}</>}
            </span>
            {value.tipo && tipo && (
                <Activo label={`Quitar filtro ${tipo.label}`} onClick={() => onChange({ ...value, tipo: "" })}>
                    <tipo.icon className="h-3.5 w-3.5" />
                    {tipo.label}
                </Activo>
            )}
            {value.plataformas.map((p) => (
                <Activo key={p} label={`Quitar filtro ${marca(p).nombre}`} onClick={() => onChange(alternar(value, p))}>
                    <MarcaIcono platform={p} size={14} />
                    {marca(p).nombre}
                </Activo>
            ))}
            {value.precio && (
                <Activo label="Quitar filtro de precio" onClick={() => onChange({ ...value, precio: null })}>
                    {formatCOP(value.precio[0])} – {formatCOP(value.precio[1])}
                </Activo>
            )}
        </div>
    )
}

function Activo({ label, onClick, children }: Readonly<{ label: string; onClick: () => void; children: ReactNode }>) {
    return (
        <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 pl-3 pr-1 text-xs font-medium text-accent">
            {children}
            <button
                type="button"
                aria-label={label}
                onClick={onClick}
                className="flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-accent/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
                <X className="h-3.5 w-3.5" />
            </button>
        </span>
    )
}

/* ─────────────────────────────── Precio ─────────────────────────────── */

function RangoTexto({ limites, value }: Readonly<{ limites: [number, number] | null; value: [number, number] | null }>) {
    if (!limites) return <SkeletonBar className="w-32" />
    const [lo, hi] = value ?? limites
    return <span className="font-medium tabular-nums text-white">{formatCOP(lo)} – {formatCOP(hi)}</span>
}

/** Clases del pulgar del deslizador (Chrome/Safari y Firefox). La pista no recibe clics: solo los pulgares, para poder mover los dos. */
const PULGAR =
    "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-accent [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-black/40 " +
    "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-accent [&::-moz-range-thumb]:bg-white"

interface RangoPrecioProps {
    /** Precio mínimo y máximo del catálogo. null = aún carga o no hay productos. */
    limites: [number, number] | null
    value: [number, number] | null
    onChange: (value: [number, number] | null) => void
}

/** Rango de precio con dos pulgares. Si vuelve a cubrir todo el catálogo, el filtro queda en null (sin límite). */
function RangoPrecio({ limites, value, onChange }: Readonly<RangoPrecioProps>) {
    const [min, max] = limites ?? [0, 0]
    const [lo, hi] = value ?? [min, max]
    const sinRango = max <= min
    const pct = (v: number) => (sinRango ? 0 : ((v - min) / (max - min)) * 100)

    const cambiar = (a: number, b: number) => onChange(a <= min && b >= max ? null : [a, b])

    return (
        <div className="relative h-6">
            <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/10" />
            <div
                className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-accent"
                style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }}
            />
            <input
                type="range"
                aria-label="Precio mínimo"
                aria-valuetext={formatCOP(lo)}
                min={min}
                max={max}
                step={PASO}
                value={lo}
                disabled={!limites || sinRango}
                onChange={(e) => cambiar(Math.min(Number(e.target.value), hi), hi)}
                // Con los dos pulgares juntos en el extremo derecho, el mínimo queda encima para poder bajarlo.
                className={`pointer-events-none absolute inset-0 h-6 w-full appearance-none bg-transparent disabled:opacity-40 ${PULGAR} ${pct(lo) > 50 ? "z-20" : "z-10"}`}
            />
            <input
                type="range"
                aria-label="Precio máximo"
                aria-valuetext={formatCOP(hi)}
                min={min}
                max={max}
                step={PASO}
                value={hi}
                disabled={!limites || sinRango}
                onChange={(e) => cambiar(lo, Math.max(Number(e.target.value), lo))}
                className={`pointer-events-none absolute inset-0 z-10 h-6 w-full appearance-none bg-transparent disabled:opacity-40 ${PULGAR}`}
            />
        </div>
    )
}
