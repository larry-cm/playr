"use client"

import Card from "@ui/card"
import { SectionHeader } from "@ui/page-header"
import { IconAction } from "@ui/data-frame"
import { AlertCircle, RefreshCw, Wallet } from "lucide-react"
import { formatCOP } from "@lib/currency"
import type { SaldoProveedor } from "@lib/bodega/tipos"

interface SaldoCardProps {
    /** undefined = cargando · null = error · objeto = leído del proveedor */
    saldo: SaldoProveedor | null | undefined
    onRefresh: () => void
}

export default function SaldoCard({ saldo, onRefresh }: Readonly<SaldoCardProps>) {
    const cargando = saldo === undefined

    return (
        <Card>
            <SectionHeader
                icon={Wallet}
                title="Saldo del proveedor"
                description="Monedero en el sitio del proveedor, leído en vivo"
                action={<IconAction icon={RefreshCw} label="Actualizar saldo" onClick={onRefresh} disabled={cargando} spinning={cargando} />}
            />

            <div className="mt-6 border-t border-white/6" />

            <div className="mt-6">
                {cargando ? (
                    <div className="h-10 w-40 animate-pulse rounded-md bg-white/5" />
                ) : saldo === null ? (
                    <div className="flex items-center gap-2 text-sm text-red-400">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        No pudimos leer el saldo del proveedor. Intenta actualizar en un momento.
                    </div>
                ) : (
                    <div className="flex flex-wrap items-end justify-between gap-2">
                        <p className="text-4xl font-bold leading-none tabular-nums">{formatCOP(saldo.saldo)}</p>
                        <p className="text-xs text-secondary">
                            Leído a las {new Date(saldo.leidoEn).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })}
                        </p>
                    </div>
                )}
            </div>
        </Card>
    )
}
