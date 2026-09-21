"use client"

import Card from "@ui/card"
import { RotateCcw } from "lucide-react"
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

interface HistorialCardProps {
    /** null = no se pudo leer */
    compras: CompraHistorial[] | null
    registrandoId: number | null
    onRegistrar: (id: number) => void
}

export default function HistorialCard({ compras, registrandoId, onRegistrar }: Readonly<HistorialCardProps>) {
    return (
        <Card className="overflow-x-auto">
            <h2 className="text-lg font-semibold mb-4">Últimas compras</h2>
            <table className="w-full min-w-[44rem] text-left text-sm">
                <thead>
                    <tr className="text-xs text-secondary uppercase tracking-wide">
                        <th className="pb-3 pr-4">Fecha</th>
                        <th className="pb-3 pr-4">Producto</th>
                        <th className="pb-3 pr-4">Cant.</th>
                        <th className="pb-3 pr-4">Total</th>
                        <th className="pb-3 pr-4">Estado</th>
                        <th className="pb-3 pr-4">Pedido</th>
                        <th className="pb-3 pr-4 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {compras === null ? (
                        <tr>
                            <td className="py-8 text-center text-red-400" colSpan={7}>No pudimos cargar el historial de compras.</td>
                        </tr>
                    ) : compras.length === 0 ? (
                        <tr>
                            <td className="py-8 text-center text-secondary" colSpan={7}>Todavía no hay compras hechas desde la bodega.</td>
                        </tr>
                    ) : (
                        compras.map((c) => {
                            const estado = estadoDe(c)
                            return (
                                <tr key={c.id} className="border-t border-white/6 align-top">
                                    <td className="py-3 pr-4 text-secondary whitespace-nowrap">
                                        {new Date(c.created_at).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
                                    </td>
                                    <td className="py-3 pr-4 font-medium">{c.producto}</td>
                                    <td className="py-3 pr-4 text-secondary">{c.cantidad}</td>
                                    <td className="py-3 pr-4 tabular-nums">{formatCOP(c.total)}</td>
                                    <td className="py-3 pr-4">
                                        <span className={estado.className}>{estado.label}</span>
                                        {c.detalle && c.estado !== "registrada" && <p className="text-xs text-secondary mt-0.5 max-w-xs">{c.detalle}</p>}
                                    </td>
                                    <td className="py-3 pr-4 text-secondary">{c.pedido_proveedor === null ? "--" : `#${c.pedido_proveedor}`}</td>
                                    <td className="py-3 pr-4">
                                        <div className="flex items-center justify-end">
                                            {puedeRegistrar(c) && (
                                                <button
                                                    type="button"
                                                    onClick={() => onRegistrar(c.id)}
                                                    disabled={registrandoId !== null}
                                                    title="Volver a leer la entrega del pedido y registrarla en el inventario"
                                                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/3 px-2.5 text-xs hover:border-accent/30 hover:bg-accent/10 hover:text-accent disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                                                >
                                                    <RotateCcw className={`h-3.5 w-3.5 ${registrandoId === c.id ? "animate-spin" : ""}`} />
                                                    {registrandoId === c.id ? "Registrando..." : "Registrar"}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )
                        })
                    )}
                </tbody>
            </table>
        </Card>
    )
}
