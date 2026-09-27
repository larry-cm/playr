"use client"

import Card from "@ui/card"
import { SectionHeader } from "@ui/page-header"
import { AlertCircle, Wallet } from "lucide-react"
import { formatCOP } from "@lib/currency"
import type { SaldoProveedor } from "@lib/bodega/tipos"

interface SaldoCardProps {
    /** undefined = cargando · null = error · objeto = leído del proveedor */
    saldo: SaldoProveedor | null | undefined
}

/**
 * Como todas las secciones de Bodega: encabezado dentro de la tarjeta, línea y contenido. Sin botón: el saldo se vuelve a leer solo al
 * cargar la página y después de cada compra.
 */
export default function SaldoCard({ saldo }: Readonly<SaldoCardProps>) {
    const cargando = saldo === undefined

    return (
        <Card className="flex h-full flex-col">
            <SectionHeader icon={Wallet} title="Saldo del proveedor" description="Monedero en el sitio del proveedor, leído en vivo" />

            <div className="mt-6 border-t border-white/6" />

            {/* Alto mínimo fijo: mide lo mismo cargando, con saldo o con error. */}
            <div className="mt-6 flex min-h-10 flex-1 items-center">
                {cargando ? (
                    <div className="h-10 w-40 animate-pulse rounded-md bg-white/5" />
                ) : saldo === null ? (
                    <div className="flex items-center gap-2 text-sm text-red-400">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        No pudimos leer el saldo del proveedor. Recarga la página en un momento.
                    </div>
                ) : (
                    <div className="flex w-full flex-wrap items-end justify-between gap-2">
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
