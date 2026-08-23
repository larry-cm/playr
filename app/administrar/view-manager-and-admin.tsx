"use client"

import { useEffect, useState } from "react"
import Card from "@ui/card"
import { List, Monitor, Network, Users, ChevronRight } from "lucide-react"
import Link from "next/link"

interface ViewServerProps {
    services?: {
        profiles?: number;
        accounts?: number;
        customers?: number;
    }
}

// Duración fija compartida: todos los contadores llegan a su meta al mismo tiempo.
const COUNT_DURATION_MS = 900

function Stat({ value }: { value?: number }) {
    const [display, setDisplay] = useState(0)

    useEffect(() => {
        if (!value) {
            setDisplay(0)
            return
        }
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            setDisplay(value)
            return
        }
        let raf: number
        const start = performance.now()
        const tick = (now: number) => {
            const progress = Math.min((now - start) / COUNT_DURATION_MS, 1)
            setDisplay(Math.round(value * (1 - Math.pow(1 - progress, 3))))
            if (progress < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [value])

    return <p className="text-4xl font-bold leading-none">{display}</p>
}

export default function ViewServer({
    services
}: Readonly<ViewServerProps>) {
    return (
        <Card className="h-full flex flex-col">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-accent/10">
                        <List className="w-5 h-5 text-accent" />
                    </div>
                    <h2 className="text-lg font-semibold">
                        Resumen de Servicios
                    </h2>
                </div>

            </div>

            <div className="mt-6 border-t border-white/6" />

            <div className="mt-6 flex-1 grid grid-cols-3 divide-x divide-white/6">
                <div className="flex flex-col items-center justify-center gap-3 px-2">
                    <Link href="/administrar/perfiles" className="p-3 rounded-xl bg-accent/10">
                        <Monitor className="w-6 h-6 text-accent" />
                    </Link>
                    <div className="text-center">
                        <Stat value={services ? services.profiles ?? 0 : undefined} />
                        <Link
                            href="/administrar/perfiles"
                            className="flex items-center justify-center gap-1 mt-2 group"
                            title="Ir a la pagina para manejar perfiles"
                        >
                            <p className="text-xs text-secondary tracking-wide uppercase">
                                Perfiles
                            </p>
                            <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform text-secondary" />
                        </Link>

                    </div>

                </div>
                <div className="flex flex-col items-center justify-center gap-3 px-2">
                    <Link href="/administrar/cuentas" className="p-3 rounded-xl bg-accent/10">
                        <Network className="w-6 h-6 text-accent" />
                    </Link>
                    <div className="text-center">
                        <Stat value={services ? services.accounts ?? 0 : undefined} />
                        <Link
                            href="/administrar/cuentas"
                            className="flex items-center justify-center gap-1 mt-2 group"
                            title="Ir a la pagina para administrar cuentas"
                        >
                            <p className="text-xs text-secondary tracking-wide uppercase">
                                Cuentas
                            </p>
                            <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform text-secondary" />
                        </Link>
                    </div>
                </div>
                <div className="flex flex-col items-center justify-center gap-3 px-2">
                    <Link href="/administrar/clientes" className="p-3 rounded-xl bg-accent/10">
                        <Users className="w-6 h-6 text-accent" />
                    </Link>
                    <div className="text-center">
                        <Stat value={services ? services.customers ?? 0 : undefined} />
                        <Link
                            href="/administrar/clientes"
                            className="flex items-center justify-center gap-1 mt-2 group"
                            title="Ir a la pagina para gestionar clientes"
                        >
                            <p className="text-xs text-secondary tracking-wide uppercase">
                                Clientes
                            </p>
                            <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform text-secondary" />
                        </Link>
                    </div>
                </div>
            </div>
        </Card>
    )
}