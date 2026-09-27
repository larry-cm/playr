"use client"

import Card from "@ui/card"
import CountUp from "@ui/count-up"
import { LayoutGrid, Package, ClipboardList } from "lucide-react"

interface ResumenBodegaCardProps {
    productosEnStock: number
    pendientesRegistro: number
}

/** Mismo lenguaje visual que "Resumen de Servicios" del dashboard (view-manager-and-admin.tsx): ícono + título, línea, grid de stats. */
export default function ResumenBodegaCard({ productosEnStock, pendientesRegistro }: Readonly<ResumenBodegaCardProps>) {
    const hayPendientes = pendientesRegistro > 0

    return (
        <Card className="h-full flex flex-col">
            <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-accent/10">
                    <LayoutGrid className="w-5 h-5 text-accent" />
                </div>
                <h2 className="text-lg font-semibold">Resumen</h2>
            </div>

            <div className="mt-6 border-t border-white/6" />

            <div className="mt-6 flex-1 grid grid-cols-2 divide-x divide-white/6">
                <div className="flex flex-col items-center justify-center gap-3 px-2">
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

                <div className="flex flex-col items-center justify-center gap-3 px-2">
                    <div className={`p-3 rounded-xl ${hayPendientes ? "bg-amber-400/10" : "bg-accent/10"}`}>
                        <ClipboardList className={`w-6 h-6 ${hayPendientes ? "text-amber-400" : "text-accent"}`} />
                    </div>
                    <div className="text-center">
                        <p className={`text-4xl font-bold leading-none ${hayPendientes ? "text-amber-400" : ""}`}>
                            <CountUp value={pendientesRegistro} />
                        </p>
                        <p className="mt-2 text-xs text-secondary tracking-wide uppercase">Por registrar</p>
                    </div>
                </div>
            </div>
        </Card>
    )
}
