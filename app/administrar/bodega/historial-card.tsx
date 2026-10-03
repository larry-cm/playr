"use client"

import { History, RefreshCw } from "lucide-react"
import Button from "@ui/button"
import { SectionHeader } from "@ui/page-header"
import { EmptyRow, IconAction, MobileCard, MobileEmpty, MobileFrame, ROW_CLASS, SkeletonCards, SkeletonRows, TABLE_BODY_HEIGHT, TableFrame, Td, Th } from "@ui/data-frame"
import { formatCOP } from "@lib/currency"
import { formatColombianDateTime } from "@lib/date"
import { capitalizar } from "@lib/text"
import type { PedidoProveedor } from "@lib/bodega/tipos"

// todas las columnas con el mismo color de letra; solo el aviso de pedido anulado lleva color propio
const HEADER = ["Productos", "Total", "Fecha"]

const fechaPedido = (p: PedidoProveedor) =>
    new Date(p.fecha).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" })

/** Sin columna de estado (casi todos quedan "Completado" al instante): solo se marca el pedido que no gastó saldo. */
const anulado = (estado: string) => /fall|cancel|reembols/i.test(estado)

/** Productos del pedido; debajo, si se hizo a mano en el sitio (no desde Bodega) y si quedó anulado. */
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
            {p.origen === "proveedor" && (
                <span
                    className="mt-1 inline-block rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent"
                    title="Pedido hecho directamente en el sitio del proveedor, no desde Bodega"
                >
                    En el sitio
                </span>
            )}
            {anulado(p.estado) && <p className="mt-0.5 text-xs text-red-400">{p.estado}</p>}
        </>
    )
}

interface HistorialCardProps {
    /** undefined = cargando · null = no se pudo leer */
    pedidos: PedidoProveedor[] | null | undefined
    /** ISO de la última sincronización con el sitio del proveedor; null = nunca. */
    sincronizadoEn: string | null
    /** Hay una sincronización en curso (se siguen mostrando los pedidos guardados). */
    sincronizando: boolean
    /** La última sincronización falló (lo guardado sigue a la vista). */
    errorSync: boolean
    /** Sincroniza con el sitio del proveedor (botón del encabezado y "Reintentar" del estado de error). */
    onSync: () => void
}

/** Ancla del registro: el aviso de compra dudosa lleva hasta aquí. */
export const HISTORIAL_ID = "registro-de-compras"

function descripcion({ pedidos, sincronizadoEn, sincronizando, errorSync }: Omit<HistorialCardProps, "onSync">) {
    if (pedidos === undefined && !sincronizando) return "Guardado en la plataforma"
    const estado = sincronizando
        ? "sincronizando con el proveedor…"
        : sincronizadoEn
          ? `sincronizado ${formatColombianDateTime(sincronizadoEn)}`
          : "aún sin sincronizar con el proveedor"
    return (
        <>
            Guardado en la plataforma · {estado}
            {errorSync && !sincronizando && <span className="text-red-400"> · no se pudo sincronizar</span>}
        </>
    )
}

/**
 * Registro global: todos los pedidos de la cuenta del proveedor, hechos desde Bodega o a mano en su sitio, guardados en la base
 * (llegan con la página). Se sincroniza con el sitio solo una vez al día, con el botón del encabezado o tras una compra dudosa. El
 * alto no depende de los datos (cargando, vacía o llena mide lo mismo, así la tarjeta no "crece" cuando llegan): desde lg iguala el
 * de la columna de saldo y resumen, debajo es fijo.
 */
export default function HistorialCard(props: Readonly<HistorialCardProps>) {
    const { pedidos, sincronizando, onSync } = props
    const vacio = pedidos === null ? (
        <span className="inline-flex flex-col items-center gap-3">
            No pudimos leer los pedidos del proveedor.
            <Button variant="secondary" size="sm" onClick={onSync} isLoading={sincronizando} leftIcon={<RefreshCw className="h-4 w-4" />}>
                Reintentar
            </Button>
        </span>
    ) : pedidos?.length === 0 ? (
        "La cuenta del proveedor todavía no tiene pedidos."
    ) : null
    const vacioClass = pedidos === null ? "text-red-400" : undefined

    const heading = (
        <SectionHeader
            icon={History}
            title="Registro de compras"
            description={descripcion(props)}
            action={
                <IconAction
                    icon={RefreshCw}
                    label="Sincronizar con el proveedor"
                    onClick={onSync}
                    disabled={pedidos === undefined || sincronizando}
                    spinning={sincronizando}
                />
            }
        />
    )

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
