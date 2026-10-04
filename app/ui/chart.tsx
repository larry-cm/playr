"use client"

// Gráficos al estilo shadcn/ui (https://ui.shadcn.com/charts): Recharts + un `config` que da nombre y color a cada serie.
// Cada serie expone su color como CSS var (--color-<clave>), así las marcas usan fill="var(--color-gasto)" y el tooltip y la
// leyenda leen la misma etiqueta. Adaptado al tema oscuro del panel (sin modo claro).
import { createContext, useContext, useId, type ComponentProps, type CSSProperties, type ReactNode } from "react"
import * as Recharts from "recharts"

export type ChartConfig = Record<string, { label: string; color: string }>

const ChartContext = createContext<ChartConfig | null>(null)

export function useChart() {
    const config = useContext(ChartContext)
    if (!config) throw new Error("useChart debe usarse dentro de <ChartContainer>")
    return config
}

export function ChartContainer({
    config,
    className = "",
    children,
    ...props
}: Readonly<{ config: ChartConfig; className?: string; children: ComponentProps<typeof Recharts.ResponsiveContainer>["children"] } & Omit<ComponentProps<"div">, "children">>) {
    const id = useId()
    const vars = Object.fromEntries(Object.entries(config).map(([k, v]) => [`--color-${k}`, v.color])) as CSSProperties
    return (
        <ChartContext.Provider value={config}>
            <div
                data-chart={id}
                style={vars}
                className={[
                    "w-full text-xs",
                    // ejes y grilla recesivos (texto secundario, líneas casi invisibles)
                    "[&_.recharts-cartesian-axis-tick_text]:fill-secondary",
                    "[&_.recharts-cartesian-grid_line]:stroke-white/6",
                    "[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-white/4",
                    "[&_.recharts-surface]:outline-none",
                    className,
                ].join(" ")}
                {...props}
            >
                <Recharts.ResponsiveContainer>{children}</Recharts.ResponsiveContainer>
            </div>
        </ChartContext.Provider>
    )
}

export const ChartTooltip = Recharts.Tooltip

/** Caja del tooltip con el estilo del panel; el contenido lo arma cada gráfico. */
export function ChartTooltipBox({ title, children }: Readonly<{ title: ReactNode; children: ReactNode }>) {
    return (
        <div className="min-w-44 max-w-80 rounded-xl border border-white/10 bg-background/95 px-3 py-2.5 text-xs text-foreground shadow-2xl backdrop-blur-xl">
            <p className="mb-1.5 font-medium">{title}</p>
            {children}
        </div>
    )
}

/** Fila "● etiqueta ... valor" del tooltip; el punto lleva el color de la serie, el texto siempre en tinta de texto. */
export function ChartTooltipRow({ serie, value }: Readonly<{ serie: string; value: ReactNode }>) {
    const config = useChart()
    return (
        <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-secondary">
                <span className="size-2 rounded-xs" style={{ background: `var(--color-${serie})` }} />
                {config[serie]?.label ?? serie}
            </span>
            <span className="font-mono font-medium tabular-nums">{value}</span>
        </div>
    )
}

/** Marcas redondas (1-2-5 × 10^n, unas 4) por debajo del techo; el eje igual termina en el techo exacto. */
export function marcasEje(techo: number): number[] {
    const crudo = techo / 4
    const base = 10 ** Math.floor(Math.log10(crudo))
    const paso = [1, 2, 5, 10].map((m) => m * base).find((p) => p >= crudo) ?? base * 10
    return Array.from({ length: Math.floor(techo / paso) + 1 }, (_, i) => i * paso)
}
