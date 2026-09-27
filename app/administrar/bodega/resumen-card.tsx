"use client"

import type { ComponentType, ReactNode } from "react"
import Card from "@ui/card"
import CountUp from "@ui/count-up"
import { SectionHeader } from "@ui/page-header"
import { LayoutGrid, Package, Receipt, ShoppingBag } from "lucide-react"
import { formatCOP } from "@lib/currency"
import type { PedidoProveedor } from "@lib/bodega/tipos"

interface ResumenBodegaCardProps {
    productosEnStock: number
    /** Registro global de pedidos: undefined = cargando · null = no se pudo leer */
    pedidos: PedidoProveedor[] | null | undefined
}

/** "2026-09" del instante dado, en hora de Colombia (un pedido del 30 a las 9 p. m. no debe caer en el mes siguiente por UTC). */
const mesBogota = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit" })

function Stat({ icon: Icon, label, children }: Readonly<{ icon: ComponentType<{ className?: string }>; label: string; children: ReactNode }>) {
    return (
        <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-xl bg-accent/10 p-3">
                <Icon className="h-5 w-5 text-accent" />
            </div>
            <div className="min-w-0">
                {/* h-6 fijo: el esqueleto de carga y el número miden lo mismo */}
                <p className="flex h-6 items-center text-2xl font-bold leading-none tabular-nums">{children}</p>
                <p className="mt-1.5 text-sm text-secondary">{label}</p>
            </div>
        </div>
    )
}

/** Como todas las secciones de Bodega: encabezado dentro de la tarjeta, línea y contenido, con su alto natural (sin aire de relleno). */
export default function ResumenBodegaCard({ productosEnStock, pedidos }: Readonly<ResumenBodegaCardProps>) {
    const mes = mesBogota(new Date())
    // los fallidos, cancelados o reembolsados no gastaron saldo
    const delMes = pedidos?.filter((p) => mesBogota(new Date(p.fecha)) === mes && !/fall|cancel|reembols/i.test(p.estado))
    const pendiente = pedidos === undefined ? <span className="h-6 w-16 animate-pulse rounded-md bg-white/5" /> : "--"

    return (
        <Card className="flex h-full flex-col">
            <SectionHeader icon={LayoutGrid} title="Resumen" description="Stock disponible y compras del mes" />

            <div className="mt-6 border-t border-white/6" />

            <div className="mt-6 flex flex-1 flex-col justify-center gap-4">
                <Stat icon={Receipt} label="Gastado este mes">
                    {delMes ? formatCOP(delMes.reduce((s, p) => s + p.total, 0)) : pendiente}
                </Stat>
                <Stat icon={ShoppingBag} label="Pedidos este mes">
                    {delMes ? <CountUp value={delMes.length} /> : pendiente}
                </Stat>
                <Stat icon={Package} label="Disponibles para comprar">
                    <CountUp value={productosEnStock} />
                </Stat>
            </div>
        </Card>
    )
}
