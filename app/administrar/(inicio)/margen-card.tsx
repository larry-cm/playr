"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronRight, TrendingUp } from "lucide-react"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"
import Card from "@ui/card"
import { SectionHeader } from "@ui/page-header"
import { SkeletonBar } from "@ui/data-frame"
import { ChartContainer, ChartTooltip, ChartTooltipBox, marcasEje, type ChartConfig } from "@ui/chart"
import { formatCOP } from "@lib/currency"
import { capitalizar } from "@lib/text"
import { gananciaPorPeriodo, type PeriodoGanancia, type PuntoGanancia } from "@lib/bodega/margen"
import type { Rango } from "@lib/bodega/consumo"
import SelectorRango from "@/app/administrar/(inicio)/selector-rango"

// Paleta categórica validada (dataviz, slots contiguos naranja/aqua). Cada barra es lo que valen las compras del período al
// precio de venta: abajo en naranja lo que pagamos, arriba en verde lo que ganamos (con su monto encima). Un solo eje (COP).
const config = {
    invertido: { label: "Lo que pagamos", color: "#d95926" },
    ganancia: { label: "Lo que ganamos", color: "#199e70" },
} satisfies ChartConfig

const copCompacto = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", notation: "compact", maximumFractionDigits: 1 })
const compacto = (v: number) => copCompacto.format(v).replace("K", "k")
const pct = (x: number) => `${Math.round(x * 100)}%`

function TooltipPeriodo({ active, payload }: Readonly<{ active?: boolean; payload?: { payload: PeriodoGanancia }[] }>) {
    const p = payload?.[0]?.payload
    if (!active || !p) return null
    return (
        <ChartTooltipBox title={capitalizar(p.larga)}>
            {p.compras.length === 0 ? (
                <p className="text-secondary">Sin compras de productos con precio de venta.</p>
            ) : (
                <>
                    <div className="flex flex-col gap-1">
                        <Fila color={config.ganancia.color} label="Lo que ganamos" valor={p.ganancia} fuerte />
                        <Fila color={config.invertido.color} label="Lo que pagamos" valor={p.invertido} />
                        <div className="flex justify-between gap-4 text-secondary">
                            <span className="pl-3.5">Valor de venta</span>
                            <span className="font-mono tabular-nums">{formatCOP(p.venta)}</span>
                        </div>
                    </div>
                    <ul className="mt-2 flex flex-col gap-1 border-t border-white/8 pt-2">
                        {p.compras.map((c, i) => (
                            <li key={i} className="flex justify-between gap-3 text-secondary">
                                <span className="min-w-0 truncate">{capitalizar(c.producto)}</span>
                                <span className="shrink-0 font-mono tabular-nums">{formatCOP(c.pagado)} → {formatCOP(c.venta)}</span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </ChartTooltipBox>
    )
}

function Fila({ color, label, valor, fuerte = false }: Readonly<{ color: string; label: string; valor: number; fuerte?: boolean }>) {
    return (
        <div className={`flex items-center justify-between gap-4 ${fuerte ? "font-medium" : ""}`}>
            <span className="flex items-center gap-1.5 text-secondary">
                <span className="size-2 rounded-xs" style={{ background: color }} />
                {label}
            </span>
            <span className="font-mono tabular-nums">{formatCOP(valor)}</span>
        </div>
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

/**
 * Ganancia por compras: por cada período, lo que pagamos al proveedor (naranja) y lo que ganamos al venderlo al precio del
 * catálogo (verde), apilados (juntos = valor de venta). `evolucion`: undefined = cargando · null = no se pudo leer.
 */
export default function MargenCard({ evolucion }: Readonly<{ evolucion?: PuntoGanancia[] | null }>) {
    const [rango, setRango] = useState<Rango>("todo")
    const periodos = useMemo(() => (evolucion ? gananciaPorPeriodo(evolucion, rango) : undefined), [evolucion, rango])
    const total = periodos?.reduce(
        (t, p) => ({ invertido: t.invertido + p.invertido, venta: t.venta + p.venta, ganancia: t.ganancia + p.ganancia, compras: t.compras + p.compras.length }),
        { invertido: 0, venta: 0, ganancia: 0, compras: 0 },
    )
    const techo = Math.max(1, ...(periodos ?? []).map((p) => p.venta))

    return (
        <Card className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <SectionHeader icon={TrendingUp} title="Ganancia por compras" description="Lo que pagamos al proveedor contra el precio al que vendemos" />
                <SelectorRango value={rango} onChange={setRango} />
            </div>

            {evolucion === null ? (
                <p className="text-sm text-red-400" role="alert">No se pudieron leer los productos. Recarga la página para reintentar.</p>
            ) : evolucion !== undefined && evolucion.length === 0 ? (
                <div className="flex flex-col items-start gap-1 text-sm text-secondary">
                    <p>Ninguna compra corresponde todavía a un producto con precio de venta.</p>
                    <Link href="/administrar/productos" className="inline-flex items-center gap-1 text-accent hover:text-accent-hover">
                        Fijar precios en Productos <ChevronRight className="h-4 w-4" />
                    </Link>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <Kpi label="Ganancia" value={total && formatCOP(total.ganancia)} detail={total && `Margen ${pct(total.venta ? total.ganancia / total.venta : 0)}`} />
                        <Kpi label="Invertido" value={total && formatCOP(total.invertido)} detail={total && `${total.compras} ${total.compras === 1 ? "compra" : "compras"}`} />
                        <Kpi label="Valor de venta" value={total && formatCOP(total.venta)} detail={total && "Al precio del catálogo"} />
                        <Kpi
                            label="Por cada $1.000"
                            value={total && formatCOP(total.invertido ? (total.ganancia / total.invertido) * 1000 : 0)}
                            detail={total && "Ganancia por $1.000 invertidos"}
                        />
                    </div>

                    <div className="-mx-2 flex flex-col gap-3 rounded-xl border border-white/6 p-2 sm:mx-0 sm:p-4">
                        <ul aria-label="Series" className="flex min-h-5 flex-wrap gap-x-4 gap-y-1.5 text-xs text-secondary">
                            {Object.values(config).map((s) => (
                                <li key={s.label} className="flex items-center gap-1.5">
                                    <span className="size-2.5 rounded-xs" style={{ background: s.color }} />
                                    {s.label}
                                </li>
                            ))}
                        </ul>
                        <div className="relative h-72">
                            {!periodos ? (
                                <div className="h-full animate-pulse rounded-xl bg-white/3" />
                            ) : (
                                <>
                                    <ChartContainer config={config} className="h-full" role="img" aria-label="Lo que pagamos y lo que ganamos por período">
                                        <BarChart data={periodos} margin={{ top: 20, right: 4, left: 4, bottom: 0 }} barCategoryGap={2}>
                                            <CartesianGrid vertical={false} />
                                            <XAxis dataKey="corta" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
                                            <YAxis width={64} tickLine={false} axisLine={false} domain={[0, techo]} ticks={marcasEje(techo)} tickFormatter={compacto} />
                                            <ChartTooltip cursor content={<TooltipPeriodo />} />
                                            <Bar dataKey="invertido" stackId="venta" fill="var(--color-invertido)" maxBarSize={48} isAnimationActive={false} />
                                            <Bar dataKey="ganancia" stackId="venta" fill="var(--color-ganancia)" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>
                                                {/* el monto ganado encima de cada barra (solo donde hubo compras) */}
                                                <LabelList
                                                    dataKey="ganancia"
                                                    position="top"
                                                    className="fill-foreground text-[11px] font-medium"
                                                    formatter={(v: unknown) => (typeof v === "number" && v > 0 ? `+${compacto(v)}` : "")}
                                                />
                                            </Bar>
                                        </BarChart>
                                    </ChartContainer>
                                    {total?.compras === 0 && (
                                        <div className="absolute inset-0 flex items-center justify-center text-sm text-secondary">
                                            No hubo compras de productos con precio de venta en este rango.
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
