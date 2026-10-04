"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRuta } from "@/app/administrar/sesion-tab"
import { ChevronRight, ShoppingCart } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import Card from "@ui/card"
import { SectionHeader } from "@ui/page-header"
import { SkeletonBar } from "@ui/data-frame"
import { ChartContainer, ChartTooltip, ChartTooltipBox, marcasEje, type ChartConfig } from "@ui/chart"
import { formatCOP } from "@lib/currency"
import { capitalizar } from "@lib/text"
import { calcularConsumo, type Periodo, type Rango } from "@lib/bodega/consumo"
import SelectorRango from "@/app/administrar/(inicio)/selector-rango"
import type { HistorialProveedor } from "@lib/bodega/tipos"
import { sincronizarHistorialAction } from "@action/manager-and-admin/bodega/historial-action"
import { coloresPara, COLORES_LIBRES } from "@lib/colores-plataforma"

/** Igual que Bodega: el registro guardado se sincroniza con el sitio solo si la última sincronización tiene más de un día. */
const SYNC_CADA_MS = 24 * 60 * 60 * 1000
const desactualizado = (h: HistorialProveedor) => !h.sincronizadoEn || Date.now() - Date.parse(h.sincronizadoEn) > SYNC_CADA_MS

const copCompacto = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", notation: "compact", maximumFractionDigits: 1 })
const fechaCorta = (iso: string) =>
    new Date(iso).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" })

type Serie = string
/** Separación de 1px entre tramos apilados, del color de la card. */
const SUPERFICIE = "#111116"
/** Referencia estable (el default [] en props sería un arreglo nuevo en cada render y rompería los useMemo). */
const SIN_PLATAFORMAS: string[] = []


/**
 * Detalle del período: cada plataforma con su gasto y, debajo, sus productos con el precio del producto completo (sin dividir
 * por pantalla). Con el mouse sobre un tramo (`resaltada`), esa plataforma se resalta y las demás siguen a la vista, atenuadas.
 */
function TooltipPeriodo({ active, payload, colorDe, resaltada }: Readonly<{ active?: boolean; payload?: { payload: Periodo }[]; colorDe: (plataforma: string) => string; resaltada: string | null }>) {
    const p = payload?.[0]?.payload
    if (!active || !p) return null
    const productos = Object.entries(p.detalle)
    const plataformas = Object.entries(p.plataformas).sort((a, b) => b[1] - a[1])
    const hay = resaltada !== null && p.plataformas[resaltada] !== undefined
    return (
        <ChartTooltipBox title={capitalizar(p.larga)}>
            <div className="flex justify-between gap-4">
                <span className="text-secondary">
                    {p.pedidos.length} {p.pedidos.length === 1 ? "pedido" : "pedidos"} · {p.productos} {p.productos === 1 ? "producto" : "productos"}
                </span>
                <span className="font-mono font-medium tabular-nums">{formatCOP(p.gasto)}</span>
            </div>
            {plataformas.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1 border-t border-white/8 pt-2">
                    {plataformas.map(([plataforma, gasto]) => {
                        const suyos = productos.filter(([, x]) => x.plataforma === plataforma)
                        // un solo producto: su precio es el de la plataforma, no se repite; con varios, cada uno lleva el suyo
                        const varios = suyos.length > 1
                        return (
                            <li
                                key={plataforma}
                                className={`-mx-1.5 rounded-md px-1.5 py-0.5 transition-opacity ${hay && plataforma === resaltada ? "bg-white/8 ring-1 ring-white/15" : hay ? "opacity-45" : ""}`}
                            >
                                <div className="flex items-center justify-between gap-3 font-medium">
                                    <span className="flex min-w-0 items-center gap-1.5">
                                        <span className="size-2 shrink-0 rounded-xs" style={{ background: colorDe(plataforma) }} />
                                        <span className="truncate">{plataforma}</span>
                                    </span>
                                    <span className="font-mono tabular-nums">{formatCOP(gasto)}</span>
                                </div>
                                {suyos.map(([nombre, x]) => (
                                    <div key={nombre} className="flex justify-between gap-3 pl-3.5 text-secondary">
                                        <span className="min-w-0 truncate">
                                            {capitalizar(nombre)}
                                            {x.compras > 1 && ` ×${x.compras}`}
                                            {x.pantallas > x.compras && ` · ${x.pantallas} pantallas`}
                                        </span>
                                        {varios && <span className="shrink-0 font-mono tabular-nums">{formatCOP(x.gasto)}</span>}
                                    </div>
                                ))}
                            </li>
                        )
                    })}
                </ul>
            )}
        </ChartTooltipBox>
    )
}

function Kpi({ label, value, detail }: Readonly<{ label: string; value?: string; detail?: string }>) {
    return (
        <div className="rounded-xl border border-white/6 bg-white/2 p-4">
            <p className="text-xs uppercase tracking-wide text-secondary">{label}</p>
            {value === undefined ? (
                <>
                    <SkeletonBar className="mt-2 h-7 w-28" />
                    <SkeletonBar className="mt-1.5 h-4 w-20" />
                </>
            ) : (
                <>
                    <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
                    <p className="mt-0.5 h-4 truncate text-xs text-muted">{detail}</p>
                </>
            )}
        </div>
    )
}

function variacion(actual: number, anterior: number | null): string | undefined {
    if (anterior === null) return "Desde la primera compra"
    if (anterior === 0) return actual > 0 ? "Sin compras en el período anterior" : "Igual que el período anterior"
    const pct = Math.round(((actual - anterior) / anterior) * 100)
    return `${pct > 0 ? "▲" : pct < 0 ? "▼" : "="} ${Math.abs(pct)}% vs. período anterior`
}

/**
 * Compras a los proveedores a lo largo del tiempo (registro guardado de Bodega): indicadores y barras de gasto por período
 * apiladas por plataforma, con la leyenda (nombre + color) dentro del gráfico y el detalle de productos y precios en el tooltip.
 * `historial`: undefined = cargando · null = no se pudo leer. `plataformas`: nombres de business.platform.
 */
export default function ComprasCard({ historial: inicial, plataformas = SIN_PLATAFORMAS }: Readonly<{ historial?: HistorialProveedor | null; plataformas?: string[] }>) {
    const ruta = useRuta()
    // lo sincronizado en esta visita reemplaza a lo que llegó del servidor
    const [sincronizado, setHistorial] = useState<HistorialProveedor | null>(null)
    const historial = sincronizado ?? inicial
    const [rango, setRango] = useState<Rango>("todo")
    const [sincronizando, startSync] = useTransition()
    const [errorSync, setErrorSync] = useState(false)
    const [activa, setActiva] = useState<Serie | null>(null)

    // Sin sincronizar hace más de un día (o nunca): se trae del sitio en segundo plano, mostrando mientras lo guardado.
    useEffect(() => {
        if (!inicial || !desactualizado(inicial)) return
        startSync(async () => {
            const h = await sincronizarHistorialAction().catch(() => null)
            if (h) setHistorial(h)
            else setErrorSync(true)
        })
    }, [inicial])

    const consumo = useMemo(() => (historial ? calcularConsumo(historial.pedidos, rango, plataformas) : undefined), [historial, rango, plataformas])
    const primeraVez = historial?.sincronizadoEn === null && historial.pedidos.length === 0
    const cargando = historial === undefined || (primeraVez && sincronizando)
    const c = cargando ? undefined : consumo

    // Color por plataforma según su gasto en TODO el historial (no en el rango): cambiar el rango no repinta las plataformas.
    const ranking = useMemo(
        () => (historial
            ? calcularConsumo(historial.pedidos, "todo", plataformas).plataformas.map((p) => p.nombre)
            : []),
        [historial, plataformas],
    )
    // Una serie por plataforma (clave p0, p1…: el nombre puede tener espacios o "+", no sirve de CSS var).
    const serieDe = useMemo(() => {
        const idx = new Map(ranking.map((n, i) => [n, `p${i}`]))
        return (plataforma: string): Serie => idx.get(plataforma) ?? plataforma
    }, [ranking])
    const config = useMemo(() => {
        const colores = coloresPara(ranking)
        const cfg: ChartConfig = {}
        ranking.forEach((n, i) => (cfg[`p${i}`] = { label: n, color: colores.get(n) as string }))
        return cfg
    }, [ranking])
    const colorDe = (plataforma: string) => config[serieDe(plataforma)]?.color ?? COLORES_LIBRES[0]

    // Una fila por período con el gasto de cada serie (para apilar) + el período completo (para el tooltip).
    const filas = useMemo(() => (c?.periodos ?? []).map((per) => {
        const fila: Record<string, unknown> = { ...per }
        for (const [plataforma, gasto] of Object.entries(per.plataformas)) {
            const s = serieDe(plataforma)
            fila[s] = ((fila[s] as number | undefined) ?? 0) + gasto
        }
        return fila
    }), [c, serieDe])
    // en el orden del ranking: cada plataforma ocupa siempre el mismo lugar en la pila
    const enUso = ranking.filter((n) => c?.plataformas.some((p) => p.nombre === n)).map(serieDe)
    const techo = Math.max(1, ...(c?.periodos.map((p) => p.gasto) ?? []))
    const marcas = marcasEje(techo)

    const descripcion = sincronizando
        ? "Sincronizando con el proveedor…"
        : historial?.sincronizadoEn
            ? `Actualizado ${fechaCorta(historial.sincronizadoEn)}`
            : "Pedidos hechos desde Bodega y en el sitio del proveedor"

    return (
        <Card className="@container flex h-full flex-col gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <SectionHeader icon={ShoppingCart} title="Compras a proveedores" description={descripcion} />
                <SelectorRango value={rango} onChange={setRango} />
            </div>

            {historial === null || (primeraVez && errorSync) ? (
                <p className="text-sm text-red-400" role="alert">No se pudo leer el registro de compras. Recarga la página para reintentar.</p>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
                        <Kpi label="Gastado" value={c && formatCOP(c.gastado)} detail={c && variacion(c.gastado, c.gastadoAnterior)} />
                        <Kpi label="Pedidos" value={c && String(c.pedidos)} detail={c && `${c.productos} ${c.productos === 1 ? "producto" : "productos"}`} />
                        <Kpi label="Ticket promedio" value={c && formatCOP(c.ticketPromedio)} detail={c && "Por pedido"} />
                        <Kpi
                            label="Mayor compra"
                            value={c && formatCOP(c.mayorCompra?.total ?? 0)}
                            detail={c && (c.mayorCompra ? fechaCorta(c.mayorCompra.fecha) : "—")}
                        />
                    </div>

                    <div className="-mx-2 flex flex-col gap-3 rounded-xl border border-white/6 p-2 sm:mx-0 sm:p-4">
                        {/* Leyenda dentro del gráfico: solo plataforma y color; al pasar el mouse resalta su tramo. */}
                        <ul aria-label="Plataformas" className="flex min-h-5 flex-wrap gap-x-4 gap-y-1.5 text-xs text-secondary" onMouseLeave={() => setActiva(null)}>
                            {!c ? (
                                <li><SkeletonBar className="w-48" /></li>
                            ) : (
                                enUso.map((s) => (
                                    <li
                                        key={s}
                                        onMouseEnter={() => setActiva(s)}
                                        className={`flex items-center gap-1.5 transition-opacity ${activa && activa !== s ? "opacity-40" : ""}`}
                                    >
                                        <span className="size-2.5 rounded-xs" style={{ background: config[s]?.color }} />
                                        {config[s]?.label}
                                    </li>
                                ))
                            )}
                        </ul>
                        <div className="relative h-72">
                            {!c ? (
                                <div className="h-full animate-pulse rounded-xl bg-white/3" />
                            ) : (
                                <>
                                    <ChartContainer config={config} className="h-full" role="img" aria-label={`Gasto en compras por ${c.granularidad}, por plataforma`}>
                                        <BarChart data={filas} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap={2}>
                                            <CartesianGrid vertical={false} />
                                            <XAxis dataKey="corta" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
                                            {/* de 0 a la barra más alta */}
                                            <YAxis
                                                width={64}
                                                tickLine={false}
                                                axisLine={false}
                                                domain={[0, techo]}
                                                ticks={marcas}
                                                allowDataOverflow
                                                tickFormatter={(v: number) => copCompacto.format(v).replace("K", "k")}
                                            />
                                            <ChartTooltip cursor content={<TooltipPeriodo colorDe={colorDe} resaltada={activa ? (config[activa]?.label ?? null) : null} />} />
                                            {enUso.map((s) => (
                                                <Bar
                                                    key={s}
                                                    dataKey={s}
                                                    stackId="gasto"
                                                    fill={`var(--color-${s})`}
                                                    fillOpacity={activa && activa !== s ? 0.45 : 1}
                                                    stroke={SUPERFICIE}
                                                    strokeWidth={1}
                                                    maxBarSize={36}
                                                    isAnimationActive={false}
                                                    onMouseEnter={() => setActiva(s)}
                                                    onMouseLeave={() => setActiva(null)}
                                                    // en táctil no hay hover: tocar el tramo lo selecciona
                                                    onClick={() => setActiva(s)}
                                                />
                                            ))}
                                        </BarChart>
                                    </ChartContainer>
                                    {c.pedidos === 0 && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center text-sm text-secondary">
                                            <p>No hay compras en este rango.</p>
                                            <Link href={ruta("/administrar/bodega")} className="inline-flex items-center gap-1 text-accent hover:text-accent-hover">
                                                Ir a Bodega <ChevronRight className="h-4 w-4" />
                                            </Link>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </>
            )}
        </Card>
    )
}
