"use client"

import Card from "@ui/card"
import CountUp from "@ui/count-up"
import { LayoutGrid, Package } from "lucide-react"

interface ResumenBodegaCardProps {
    productosEnStock: number
}

/** Mismo lenguaje visual que "Resumen de Servicios" del dashboard (view-manager-and-admin.tsx): ícono + título, línea, stat. */
export default function ResumenBodegaCard({ productosEnStock }: Readonly<ResumenBodegaCardProps>) {
    return (
        <Card className="h-full flex flex-col">
            <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-accent/10">
                    <LayoutGrid className="w-5 h-5 text-accent" />
                </div>
                <h2 className="text-lg font-semibold">Resumen</h2>
            </div>

            <div className="mt-6 border-t border-white/6" />

            <div className="mt-6 flex-1 flex flex-col items-center justify-center gap-3 px-2">
                <div className="p-3 rounded-xl bg-accent/10">
                    <Package className="w-6 h-6 text-accent" />
                </div>
                <div className="text-center">
                    <p className="text-4xl font-bold leading-none">
                        <CountUp value={productosEnStock} />
                    </p>
                    <p className="mt-2 text-xs text-secondary tracking-wide uppercase">En stock</p>
                </div>
            </div>
        </Card>
    )
}
