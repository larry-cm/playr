"use client"

import { History, RotateCcw } from "lucide-react"
import { formatCOP } from "@lib/currency"
import type { CompraHistorial, EstadoCompra } from "@lib/bodega/tipos"

const estadoUI: Record<EstadoCompra, { label: string; className: string }> = {
    iniciada: { label: "En curso", className: "text-sky-400" },
    pagada: { label: "Pagada", className: "text-sky-400" },
    registrada: { label: "Registrada", className: "text-emerald-400" },
    pendiente_registro: { label: "Pendiente de registro", className: "text-amber-400" },
    fallida: { label: "No se pagó", className: "text-secondary" },
    incierta: { label: "Verificar en el proveedor", className: "text-red-400" },
}

const estadoDe = (c: CompraHistorial) =>
    c.estado === "fallida" && c.detalle?.startsWith("Simulación") ? { label: "Simulada", className: "text-sky-400" } : estadoUI[c.estado]

const puedeRegistrar = (c: CompraHistorial) => c.estado === "pendiente_registro" || c.estado === "pagada"

const HEADER = ["Fecha", "Producto", "Cant.", "Total", "Estado", "Pedido"]

interface HistorialCardProps {
    /** null = no se pudo leer */
    compras: CompraHistorial[] | null
    registrandoId: number | null
    onRegistrar: (id: number) => void
}

export default function HistorialCard({ compras, registrandoId, onRegistrar }: Readonly<HistorialCardProps>) {
    return (
        <div className="w-full" style={{ color: "var(--color-foreground)" }}>
            {/* Desktop / wide: mismo marco pulido que Table.tsx, para que se vea homogéneo con la tabla de productos de arriba */}
            <div className="hidden md:block relative">
                <div
                    className="overflow-hidden rounded-2xl"
                    style={{
                        background: "linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.012))",
                        border: "1px solid rgba(255,255,255,0.08)",
                        boxShadow: "0 8px 24px rgba(2,6,23,0.28), inset 0 1px 0 rgba(255,255,255,0.04)",
                        backdropFilter: "blur(10px)",
                    }}
                >
                    <div className="p-4">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-accent/10 shrink-0">
                                <History className="h-5 w-5 text-accent" />
                            </div>
                            <h2 className="text-lg font-semibold" style={{ color: "var(--color-foreground)" }}>
                                Últimas compras
                            </h2>
                        </div>

                        {/* a diferencia de las tablas CRUD (altura fija, pensada para muchas filas), el historial suele ser corto:
                            un tope máximo evita tanto el hueco vacío con pocas compras como que la página crezca sin límite con muchas.
                            Barra delgada y oscura: la nativa de Windows es clara, de 15px, y parece un borde. */}
                        <div className="max-h-[420px] overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-gutter:stable] [scrollbar-color:rgb(255_255_255/0.2)_transparent]">
                            <table className="w-full border-collapse text-left text-sm" style={{ color: "var(--color-foreground)" }}>
                                <thead>
                                    <tr>
                                        {HEADER.map((column) => (
                                            <th
                                                key={column}
                                                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em]"
                                                style={{ color: "var(--color-secondary)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                                            >
                                                {column}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {compras === null ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-sm text-red-400">
                                                No pudimos cargar el historial de compras.
                                            </td>
                                        </tr>
                                    ) : compras.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: "var(--color-secondary)" }}>
                                                Todavía no hay compras hechas desde la bodega.
                                            </td>
                                        </tr>
                                    ) : (
                                        compras.map((c) => {
                                            const estado = estadoDe(c)
                                            return (
                                                <tr key={c.id} className="group transition-colors hover:bg-white/3">
                                                    <td
                                                        className="px-4 py-4 align-middle whitespace-nowrap"
                                                        style={{ color: "var(--color-secondary)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                                                    >
                                                        {new Date(c.created_at).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
                                                    </td>
                                                    <td className="px-4 py-4 align-middle font-medium" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                                        {c.producto}
                                                    </td>
                                                    <td
                                                        className="px-4 py-4 align-middle"
                                                        style={{ color: "var(--color-secondary)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                                                    >
                                                        {c.cantidad}
                                                    </td>
                                                    <td className="px-4 py-4 align-middle tabular-nums" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                                        {formatCOP(c.total)}
                                                    </td>
                                                    <td className="px-4 py-4 align-middle" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                                        <div className="flex items-center gap-2">
                                                            <span className={estado.className}>{estado.label}</span>
                                                            {puedeRegistrar(c) && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onRegistrar(c.id)}
                                                                    disabled={registrandoId !== null}
                                                                    aria-label="Registrar"
                                                                    title="Volver a leer la entrega del pedido y registrarla en el inventario"
                                                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/3 text-(--color-foreground) transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-(--color-accent) focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-60"
                                                                >
                                                                    <RotateCcw className={`h-3.5 w-3.5 ${registrandoId === c.id ? "animate-spin" : ""}`} />
                                                                </button>
                                                            )}
                                                        </div>
                                                        {c.detalle && c.estado !== "registrada" && (
                                                            <p className="mt-0.5 max-w-xs text-xs text-secondary">{c.detalle}</p>
                                                        )}
                                                    </td>
                                                    <td
                                                        className="px-4 py-4 align-middle"
                                                        style={{ color: "var(--color-secondary)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                                                    >
                                                        {c.pedido_proveedor === null ? "--" : `#${c.pedido_proveedor}`}
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile: mismas tarjetas apiladas que usa Table.tsx, en vez de la tabla ancha con scroll horizontal */}
            <div className="md:hidden flex flex-col gap-3">
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/3 p-3">
                    <div className="p-2 rounded-xl bg-accent/10 shrink-0">
                        <History className="h-4 w-4 text-accent" />
                    </div>
                    <h2 className="text-base font-semibold" style={{ color: "var(--color-foreground)" }}>
                        Últimas compras
                    </h2>
                </div>

                <div className="max-h-[420px] overflow-y-auto overscroll-contain flex flex-col gap-3 [scrollbar-width:thin] [scrollbar-gutter:stable] [scrollbar-color:rgb(255_255_255/0.2)_transparent]">
                    {compras === null ? (
                        <div className="px-4 py-6 text-center text-sm text-red-400">No pudimos cargar el historial de compras.</div>
                    ) : compras.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--color-secondary)" }}>
                            Todavía no hay compras hechas desde la bodega.
                        </div>
                    ) : (
                        compras.map((c) => {
                            const estado = estadoDe(c)
                            return (
                                <div
                                    key={c.id}
                                    className="shrink-0 overflow-hidden rounded-2xl"
                                    style={{
                                        background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))",
                                        border: "1px solid rgba(255,255,255,0.08)",
                                        boxShadow: "0 6px 16px rgba(2,6,23,0.25)",
                                    }}
                                >
                                    <div className="p-4">
                                        <div className="flex items-start justify-between gap-3 py-2">
                                            <div className="text-xs font-medium" style={{ color: "var(--color-secondary)" }}>Fecha</div>
                                            <div className="text-right text-sm" style={{ color: "var(--color-foreground)" }}>
                                                {new Date(c.created_at).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
                                            </div>
                                        </div>
                                        <div className="flex items-start justify-between gap-3 py-2">
                                            <div className="text-xs font-medium" style={{ color: "var(--color-secondary)" }}>Producto</div>
                                            <div className="text-right text-sm font-medium" style={{ color: "var(--color-foreground)" }}>{c.producto}</div>
                                        </div>
                                        <div className="flex items-start justify-between gap-3 py-2">
                                            <div className="text-xs font-medium" style={{ color: "var(--color-secondary)" }}>Cant.</div>
                                            <div className="text-sm" style={{ color: "var(--color-foreground)" }}>{c.cantidad}</div>
                                        </div>
                                        <div className="flex items-start justify-between gap-3 py-2">
                                            <div className="text-xs font-medium" style={{ color: "var(--color-secondary)" }}>Total</div>
                                            <div className="text-sm tabular-nums" style={{ color: "var(--color-foreground)" }}>{formatCOP(c.total)}</div>
                                        </div>
                                        <div className="flex items-start justify-between gap-3 py-2">
                                            <div className="text-xs font-medium" style={{ color: "var(--color-secondary)" }}>Estado</div>
                                            <div className="text-right text-sm">
                                                <span className={estado.className}>{estado.label}</span>
                                                {c.detalle && c.estado !== "registrada" && <p className="mt-0.5 text-xs text-secondary">{c.detalle}</p>}
                                            </div>
                                        </div>
                                        <div className="flex items-start justify-between gap-3 py-2">
                                            <div className="text-xs font-medium" style={{ color: "var(--color-secondary)" }}>Pedido</div>
                                            <div className="text-sm" style={{ color: "var(--color-foreground)" }}>
                                                {c.pedido_proveedor === null ? "--" : `#${c.pedido_proveedor}`}
                                            </div>
                                        </div>

                                        {puedeRegistrar(c) && (
                                            <div className="flex justify-end pt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => onRegistrar(c.id)}
                                                    disabled={registrandoId !== null}
                                                    className="inline-flex h-9 items-center justify-center rounded-xl border border-white/10 bg-white/3 px-3 text-sm text-(--color-foreground) transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-(--color-accent) disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    <RotateCcw className={`mr-2 h-4 w-4 ${registrandoId === c.id ? "animate-spin" : ""}`} />
                                                    {registrandoId === c.id ? "Registrando..." : "Registrar"}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        </div>
    )
}
