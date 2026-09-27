"use client"

import { History, RefreshCw } from "lucide-react"
import Button from "@ui/button"
import { SectionHeader } from "@ui/page-header"
import { EmptyRow, MobileCard, MobileEmpty, MobileFrame, ROW_CLASS, SkeletonCards, SkeletonRows, TABLE_BODY_HEIGHT, TableFrame, Td, Th } from "@ui/data-frame"
import { formatCOP } from "@lib/currency"
import { capitalizar } from "@lib/text"
import type { PedidoProveedor } from "@lib/bodega/tipos"

// todas las columnas con el mismo color de letra; solo el aviso de pedido anulado lleva color propio
const HEADER = ["Productos", "Total", "Fecha"]

const fechaPedido = (p: PedidoProveedor) =>
    new Date(p.fecha).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" })

/** Sin columna de estado (casi todos quedan "Completado" al instante): solo se marca el pedido que no gastó saldo. */
const anulado = (estado: string) => /fall|cancel|reembols/i.test(estado)

/** Productos del pedido y, debajo, solo si el pedido quedó anulado en el sitio. */
function Productos({ p }: Readonly<{ p: PedidoProveedor }>) {
    return (
        <>
            {p.productos.length === 0 ? (
                <span>{p.articulos} {p.articulos === 1 ? "artículo" : "artículos"}</span>
            ) : (
                <ul className="flex flex-col gap-0.5">
                    {p.productos.map((x) => (
                        <li key={x.nombre} className="font-semibold">
                            {capitalizar(x.nombre)}
                            {x.cantidad > 1 && <span className="ml-1 font-normal">×{x.cantidad}</span>}
                        </li>
                    ))}
                </ul>
            )}
            {anulado(p.estado) && <p className="mt-0.5 text-xs text-red-400">{p.estado}</p>}
        </>
    )
}

interface HistorialCardProps {
    /** undefined = cargando · null = no se pudo leer */
    pedidos: PedidoProveedor[] | null | undefined
    /** Vuelve a leer los pedidos (botón "Reintentar" del estado de error). */
    onRetry: () => void
}

/** Ancla del registro: el aviso de compra dudosa lleva hasta aquí. */
export const HISTORIAL_ID = "registro-de-compras"

const heading = <SectionHeader icon={History} title="Registro de compras" description="Todos los pedidos de la cuenta del proveedor, leídos en vivo" />


/**
 * Registro global: todos los pedidos de la cuenta del proveedor, hechos desde Bodega o a mano en su sitio. Se vuelve a leer solo
 * al cargar la página y después de cada compra ("Reintentar" si falla). El alto no depende de los datos (cargando, vacía o llena mide
 * lo mismo, así la tarjeta no "crece" cuando llegan): desde lg iguala el de la columna de saldo y resumen, debajo es fijo.
 */
export default function HistorialCard({ pedidos, onRetry }: Readonly<HistorialCardProps>) {
    const vacio = pedidos === null ? (
        <span className="inline-flex flex-col items-center gap-3">
            No pudimos leer los pedidos del proveedor.
            <Button variant="secondary" size="sm" onClick={onRetry} leftIcon={<RefreshCw className="h-4 w-4" />}>
                Reintentar
            </Button>
        </span>
    ) : pedidos?.length === 0 ? (
        "La cuenta del proveedor todavía no tiene pedidos."
    ) : null
    const vacioClass = pedidos === null ? "text-red-400" : undefined

    return (
        <div id={HISTORIAL_ID} className="scroll-mt-4 lg:h-full">

            <TableFrame bodyHeight={TABLE_BODY_HEIGHT} heading={heading} fill>
                <thead>
                    <tr>
                        {HEADER.map((column) => <Th key={column}>{column}</Th>)}
                    </tr>
                </thead>
                <tbody>
                    {pedidos === undefined ? (
                        <SkeletonRows columns={HEADER.length} rows={7} />
                    ) : vacio !== null || !pedidos ? (
                        <EmptyRow colSpan={HEADER.length} className={vacioClass}>{vacio}</EmptyRow>
                    ) : (
                        pedidos.map((p) => (
                            <tr key={p.id} className={ROW_CLASS}>
                                <Td>
                                    <Productos p={p} />
                                </Td>
                                <Td className="whitespace-nowrap tabular-nums">{formatCOP(p.total)}</Td>
                                <Td className="whitespace-nowrap">{fechaPedido(p)}</Td>
                            </tr>
                        ))
                    )}
                </tbody>
            </TableFrame>

            <MobileFrame bodyHeight={TABLE_BODY_HEIGHT} heading={heading}>
                {pedidos === undefined ? (
                    <SkeletonCards labels={HEADER} />
                ) : vacio !== null || !pedidos ? (
                    <MobileEmpty className={vacioClass}>{vacio}</MobileEmpty>
                ) : (
                    pedidos.map((p) => (
                        <MobileCard
                            key={p.id}
                            fields={[
                                { label: "Productos", value: <Productos p={p} /> },
                                { label: "Total", value: formatCOP(p.total), className: "tabular-nums" },
                                { label: "Fecha", value: fechaPedido(p) },
                            ]}
                        />
                    ))
                )}
            </MobileFrame>
        </div>
    )
}
