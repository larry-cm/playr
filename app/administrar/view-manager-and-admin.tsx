import Card from "@ui/card";
import { List, Monitor, Network, Users, ChevronRight } from "lucide-react";
import Link from "next/link";

interface ViewServerProps {
    perfiles?: number;
    cuentas?: number;
    clientes?: number;
}

export default function ViewServer({
    perfiles = 0,
    cuentas = 0,
    clientes = 0,
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
                        <p className="text-4xl font-bold leading-none">{perfiles}</p>
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
                        <p className="text-4xl font-bold leading-none">{cuentas}</p>
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
                        <p className="text-4xl font-bold leading-none">{clientes}</p>
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