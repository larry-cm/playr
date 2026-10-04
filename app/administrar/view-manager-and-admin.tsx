"use client"

import Card from "@ui/card"
import CountUp from "@ui/count-up"
import { SectionHeader } from "@ui/page-header"
import { List, Monitor, Network, ChevronRight } from "lucide-react"
import Link from "next/link"
import { useRuta } from "@/app/administrar/sesion-tab"

interface ViewServerProps {
    services?: {
        profiles?: number;
        accounts?: number;
    }
}

export default function ViewServer({
    services
}: Readonly<ViewServerProps>) {
    const ruta = useRuta()
    return (
        <Card className="h-full flex flex-col">
            <SectionHeader icon={List} title="Resumen de Servicios" />

            <div className="mt-6 border-t border-white/6" />

            <div className="mt-6 flex-1 grid grid-cols-2 divide-x divide-white/6">
                <div className="flex flex-col items-center justify-center gap-3 px-2">
                    <Link href={ruta("/administrar/perfiles")} className="p-3 rounded-xl bg-accent/10" aria-label="Ir a Perfiles">
                        <Monitor className="w-6 h-6 text-accent" />
                    </Link>
                    <div className="text-center">
                        <p className="text-4xl font-bold leading-none">
                            <CountUp value={services ? services.profiles ?? 0 : undefined} />
                        </p>
                        <Link
                            href={ruta("/administrar/perfiles")}
                            className="flex items-center justify-center gap-1 mt-2 group"
                            title="Ir a la página de perfiles"
                        >
                            <p className="text-xs text-secondary tracking-wide uppercase">
                                Perfiles
                            </p>
                            <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform text-secondary" />
                        </Link>

                    </div>

                </div>
                <div className="flex flex-col items-center justify-center gap-3 px-2">
                    <Link href={ruta("/administrar/cuentas")} className="p-3 rounded-xl bg-accent/10" aria-label="Ir a Cuentas">
                        <Network className="w-6 h-6 text-accent" />
                    </Link>
                    <div className="text-center">
                        <p className="text-4xl font-bold leading-none">
                            <CountUp value={services ? services.accounts ?? 0 : undefined} />
                        </p>
                        <Link
                            href={ruta("/administrar/cuentas")}
                            className="flex items-center justify-center gap-1 mt-2 group"
                            title="Ir a la página de cuentas"
                        >
                            <p className="text-xs text-secondary tracking-wide uppercase">
                                Cuentas
                            </p>
                            <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform text-secondary" />
                        </Link>
                    </div>
                </div>
            </div>
        </Card>
    )
}
