"use client"

import { History, RotateCcw } from "lucide-react"
import { SectionHeader } from "@ui/page-header"
import { EmptyRow, IconAction, MobileAction, MobileCard, MobileEmpty, MobileFrame, ROW_CLASS, TABLE_BODY_MAX_HEIGHT, TableFrame, Td, Th } from "@ui/data-frame"
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

const fechaCompra = (c: CompraHistorial) => new Date(c.created_at).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })

const REGISTRAR_TITLE = "Volver a leer la entrega del pedido y registrarla en el inventario"

interface HistorialCardProps {
    /** null = no se pudo leer */
    compras: CompraHistorial[] | null
    registrandoId: number | null
    onRegistrar: (id: number) => void
}

export default function HistorialCard({ compras, registrandoId, onRegistrar }: Readonly<HistorialCardProps>) {
    return (
        <section className="flex flex-col gap-3">
            <SectionHeader icon={History} title="Últimas compras" />

            {/* Mismo marco que el catálogo de arriba; el historial suele ser corto, así que su alto es un tope y no fijo. */}
            <TableFrame bodyHeight={TABLE_BODY_MAX_HEIGHT}>
                <thead>
                    <tr>
                        {HEADER.map((column) => <Th key={column}>{column}</Th>)}
                    </tr>
                </thead>
                <tbody>
                    {compras === null ? (
                        <EmptyRow colSpan={HEADER.length} className="text-red-400">No pudimos cargar el historial de compras.</EmptyRow>
                    ) : compras.length === 0 ? (
                        <EmptyRow colSpan={HEADER.length}>Todavía no hay compras hechas desde la bodega.</EmptyRow>
                    ) : (
                        compras.map((c) => {
                            const estado = estadoDe(c)
                            return (
                                <tr key={c.id} className={ROW_CLASS}>
                                    <Td className="whitespace-nowrap text-secondary">{fechaCompra(c)}</Td>
                                    <Td className="font-semibold">{c.producto}</Td>
                                    <Td className="text-secondary">{c.cantidad}</Td>
                                    <Td className="whitespace-nowrap tabular-nums">{formatCOP(c.total)}</Td>
                                    <Td>
                                        <div className="flex items-center gap-2">
                                            <span className={estado.className}>{estado.label}</span>
                                            {puedeRegistrar(c) && (
                                                <IconAction
                                                    icon={RotateCcw}
                                                    label="Registrar"
                                                    title={REGISTRAR_TITLE}
                                                    onClick={() => onRegistrar(c.id)}
                                                    disabled={registrandoId !== null}
                                                    spinning={registrandoId === c.id}
                                                />
                                            )}
                                        </div>
                                        {c.detalle && c.estado !== "registrada" && <p className="mt-0.5 max-w-xs text-xs text-secondary">{c.detalle}</p>}
                                    </Td>
                                    <Td className="text-secondary">{c.pedido_proveedor === null ? "--" : `#${c.pedido_proveedor}`}</Td>
                                </tr>
                            )
                        })
                    )}
                </tbody>
            </TableFrame>

            <MobileFrame bodyHeight={TABLE_BODY_MAX_HEIGHT}>
                {compras === null ? (
                    <MobileEmpty className="text-red-400">No pudimos cargar el historial de compras.</MobileEmpty>
                ) : compras.length === 0 ? (
                    <MobileEmpty>Todavía no hay compras hechas desde la bodega.</MobileEmpty>
                ) : (
                    compras.map((c) => {
                        const estado = estadoDe(c)
                        return (
                            <MobileCard
                                key={c.id}
                                fields={[
                                    { label: "Fecha", value: fechaCompra(c) },
                                    { label: "Producto", value: c.producto, className: "font-semibold" },
                                    { label: "Cant.", value: c.cantidad },
                                    { label: "Total", value: formatCOP(c.total), className: "tabular-nums" },
                                    {
                                        label: "Estado",
                                        value: (
                                            <>
                                                <span className={estado.className}>{estado.label}</span>
                                                {c.detalle && c.estado !== "registrada" && <p className="mt-0.5 text-xs text-secondary">{c.detalle}</p>}
                                            </>
                                        ),
                                    },
                                    { label: "Pedido", value: c.pedido_proveedor === null ? "--" : `#${c.pedido_proveedor}` },
                                ]}
                                actions={
                                    puedeRegistrar(c) ? (
                                        <MobileAction
                                            icon={RotateCcw}
                                            label={registrandoId === c.id ? "Registrando..." : "Registrar"}
                                            title={REGISTRAR_TITLE}
                                            onClick={() => onRegistrar(c.id)}
                                            disabled={registrandoId !== null}
                                            spinning={registrandoId === c.id}
                                        />
                                    ) : undefined
                                }
                            />
                        )
                    })
                )}
            </MobileFrame>
        </section>
    )
}
