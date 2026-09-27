"use client"

import Card from "@ui/card"
import { SectionHeader } from "@ui/page-header"
import { ShoppingBag, ChevronRight, MessageCircle } from "lucide-react"
import Link from "next/link"
import SoporteCard, { SOPORTE_ID } from "@/app/administrar/soporte-card"

const LINK_CLASS =
    "group flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-white/3 px-4 py-3 text-sm text-white transition-colors hover:border-accent/30 hover:bg-accent/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"

/**
 * Inicio del cliente. Aún no hay de dónde leer los perfiles que compró (ni sus problemas o cambios), así que en vez de
 * contadores en cero se le muestra qué puede hacer: pedir en la Tienda o escribir a soporte.
 */
export default function ViewClientPage({ telefonoAsesor }: Readonly<{ /** Ver SoporteCard: "" = no configurado · undefined = aún carga. */ telefonoAsesor?: string }>) {
    return (
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
                <Card className="h-full flex flex-col">
                    <SectionHeader icon={ShoppingBag} title="Tus perfiles" description="Elige lo que quieres ver y pídelo por WhatsApp." />

                    <div className="mt-6 border-t border-white/6" />

                    <div className="mt-6 flex flex-1 flex-col gap-4">
                        <p className="text-sm text-secondary">
                            En la Tienda ves los perfiles disponibles con su precio. Elige uno o varios y envía el pedido: un asesor te
                            responde por WhatsApp con los datos de acceso. Si un perfil deja de funcionar, escríbenos desde Soporte.
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Link href="/administrar/tienda" className={LINK_CLASS}>
                                <ShoppingBag className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                                <span className="flex-1 font-medium">Ir a la Tienda</span>
                                <ChevronRight className="h-4 w-4 text-secondary transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                            </Link>
                            <a href={`#${SOPORTE_ID}`} className={LINK_CLASS}>
                                <MessageCircle className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                                <span className="flex-1 font-medium">Contactar a soporte</span>
                                <ChevronRight className="h-4 w-4 text-secondary transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                            </a>
                        </div>
                    </div>
                </Card>
            </div>

            <SoporteCard telefonoAsesor={telefonoAsesor} />
        </section>
    )
}
