"use client"

import Card from "@ui/card"
import { SectionHeader } from "@ui/page-header"
import { AlertTriangle, RefreshCw, ChevronRight, Monitor, List } from "lucide-react"
import Link from "next/link"
import SoporteCard from "@/app/administrar/soporte-card"

export default function ViewClientPage() {
    return (
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
                <Card className="h-full flex flex-col">
                    <SectionHeader
                        icon={List}
                        title="Resumen de Perfiles"
                        action={
                        <Link
                            href="/administrar/tienda"
                            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                            title="Ver más"
                        >
                            <ChevronRight className="w-5 h-5 text-secondary" />
                        </Link>
                        }
                    />

                    <div className="mt-6 border-t border-white/6" />

                    <div className="mt-6 flex-1 grid grid-cols-3 divide-x divide-white/6">
                        <div className="flex flex-col items-center justify-center gap-3 px-2">
                            <div className="p-3 rounded-xl bg-accent/10">
                                <Monitor className="w-6 h-6 text-accent" />
                            </div>
                            <div className="text-center">
                                <p className="text-4xl font-bold leading-none">0</p>
                                <p className="mt-2 text-xs text-secondary tracking-wide uppercase">
                                    Perfiles
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col items-center justify-center gap-3 px-2">
                            <div className="p-3 rounded-xl bg-amber-400/10">
                                <AlertTriangle className="w-6 h-6 text-amber-400" />
                            </div>
                            <div className="text-center">
                                <p className="text-4xl font-bold leading-none">0</p>
                                <p className="mt-2 text-xs text-secondary tracking-wide uppercase">
                                    Problemas
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col items-center justify-center gap-3 px-2">
                            <div className="p-3 rounded-xl bg-sky-400/10">
                                <RefreshCw className="w-6 h-6 text-sky-400" />
                            </div>
                            <div className="text-center">
                                <p className="text-4xl font-bold leading-none">0</p>
                                <p className="mt-2 text-xs text-secondary tracking-wide uppercase">
                                    Cambios
                                </p>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            <SoporteCard />
        </section>
    )
}