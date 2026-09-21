"use client"

import Card from "@ui/card"
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
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-accent/10">
                        <Wallet className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold">Saldo del proveedor</h2>
                        <p className="text-xs text-secondary">Monedero en el sitio del proveedor, leído en vivo</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onRefresh}
                    disabled={cargando}
                    aria-label="Actualizar saldo"
                    title="Actualizar saldo"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/3 text-(--color-foreground) transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-(--color-accent) focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                >
                    <RefreshCw className={`h-4 w-4 ${cargando ? "animate-spin" : ""}`} />
                </button>
            </div>

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
