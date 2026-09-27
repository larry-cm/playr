"use client"

import type { ReactNode } from "react"
import { History, RotateCcw } from "lucide-react"
import { SectionHeader } from "@ui/page-header"
import { EmptyRow, IconAction, MobileAction, MobileCard, MobileEmpty, MobileFrame, ROW_CLASS, TABLE_BODY_HEIGHT, TableFrame, Td, Th } from "@ui/data-frame"
import { formatCOP } from "@lib/currency"
import { capitalizar } from "@lib/text"
import type { PedidoRegistro } from "@lib/bodega/tipos"

// todas las columnas con el mismo color de letra; solo los avisos (anulado, sin registrar) llevan color propio
const HEADER = ["Productos", "Total", "Fecha"]

const fechaPedido = (p: PedidoRegistro) =>
    new Date(p.fecha).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" })

/** Sin columna de estado (casi todos quedan "Completado" al instante): solo se marca el pedido que no gastó saldo. */
const anulado = (estado: string) => /fall|cancel|reembols/i.test(estado)

const REGISTRAR_TITLE = "Volver a leer la entrega del pedido y registrarla en el inventario"

/** Productos del pedido y, debajo, solo lo que pide atención: un pedido anulado en el sitio o una compra de Bodega sin registrar
 * (con su motivo y, en escritorio, el botón «Registrar» que llega como children). */
function Productos({ p, children }: Readonly<{ p: PedidoRegistro; children?: ReactNode }>) {
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
            {p.pendiente && (
                <div className="mt-1 flex items-center gap-2">
                    <p className="max-w-xs text-xs text-amber-400">
                        Sin registrar en el inventario{p.pendiente.detalle && <span className="text-secondary"> · {p.pendiente.detalle}</span>}
                    </p>
                    {children}
                </div>
            )}
        </>
    )
}

interface HistorialCardProps {
    /** undefined = cargando · null = no se pudo leer */
    pedidos: PedidoRegistro[] | null | undefined
    registrandoId: number | null
    onRegistrar: (compraId: number) => void
}

const heading = <SectionHeader icon={History} title="Registro de compras" description="Todos los pedidos de la cuenta del proveedor, leídos en vivo" />

const SKELETON = [0, 1, 2, 3, 4, 5, 6]
const Barra = ({ w }: { w: string }) => <div className={`h-4 ${w} animate-pulse rounded-md bg-white/5`} />

/**
 * Registro global: todos los pedidos de la cuenta del proveedor, hechos desde Bodega o a mano en su sitio. Se vuelve a leer solo
 * al cargar la página y después de cada compra o registro (sin botón). El alto no depende de los datos (cargando, vacía o llena mide
 * lo mismo, así la tarjeta no "crece" cuando llegan): desde lg iguala el de la columna de saldo y resumen, debajo es fijo.
 */
export default function HistorialCard({ pedidos, registrandoId, onRegistrar }: Readonly<HistorialCardProps>) {
    const vacio = pedidos === null ? (
        "No pudimos leer los pedidos del proveedor. Recarga la página en un momento."
    ) : pedidos?.length === 0 ? (
        "La cuenta del proveedor todavía no tiene pedidos."
    ) : null
    const vacioClass = pedidos === null ? "text-red-400" : undefined

    return (
        <>

            <TableFrame bodyHeight={TABLE_BODY_HEIGHT} heading={heading} fill>
                <thead>
                    <tr>
                        {HEADER.map((column) => <Th key={column}>{column}</Th>)}
                    </tr>
                </thead>
                <tbody>
                    {pedidos === undefined ? (
                        SKELETON.map((i) => (
                            <tr key={i}>
                                <Td><Barra w="w-44" /></Td>
                                <Td><Barra w="w-16" /></Td>
                                <Td><Barra w="w-32" /></Td>
                            </tr>
                        ))
                    ) : vacio !== null || !pedidos ? (
                        <EmptyRow colSpan={HEADER.length} className={vacioClass}>{vacio}</EmptyRow>
                    ) : (
                        pedidos.map((p) => (
                            <tr key={p.id} className={ROW_CLASS}>
                                <Td>
                                    <Productos p={p}>
                                        {p.pendiente && (
                                            <IconAction
                                                icon={RotateCcw}
                                                label="Registrar"
                                                title={REGISTRAR_TITLE}
                                                onClick={() => onRegistrar(p.pendiente!.compraId)}
                                                disabled={registrandoId !== null}
                                                spinning={registrandoId === p.pendiente.compraId}
                                            />
                                        )}
                                    </Productos>
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
                    SKELETON.slice(0, 3).map((i) => <div key={i} className="h-44 shrink-0 animate-pulse rounded-2xl bg-white/3" />)
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
                            actions={
                                p.pendiente ? (
                                    <MobileAction
                                        icon={RotateCcw}
                                        label={registrandoId === p.pendiente.compraId ? "Registrando..." : "Registrar"}
                                        title={REGISTRAR_TITLE}
                                        onClick={() => onRegistrar(p.pendiente!.compraId)}
                                        disabled={registrandoId !== null}
                                        spinning={registrandoId === p.pendiente.compraId}
                                    />
                                ) : undefined
                            }
                        />
                    ))
                )}
            </MobileFrame>
        </>
    )
}
