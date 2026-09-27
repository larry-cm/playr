"use client"

import { useState, useEffect } from "react"
import Card from "@ui/card"
import { SectionHeader } from "@ui/page-header"
import Button from "@ui/button"
import { MessageCircle, CircleCheck } from "lucide-react"
import { supabase } from "@lib/supabase/client"
import { whatsappAdvisorNumber } from "@lib/const"

// Número del asesor sin signos (wa.me solo acepta dígitos). Vacío = no configurado.
const telefonoAsesor = (whatsappAdvisorNumber ?? "").replace(/\D/g, "")

/** Ancla de la tarjeta: el inicio del cliente enlaza aquí. */
export const SOPORTE_ID = "soporte"

export default function SoporteCard() {
    const [razon, setRazon] = useState("")
    const [correo, setCorreo] = useState<string | null>(null)

    // El correo va en el mensaje para que el asesor ubique al cliente sin preguntarle.
    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => setCorreo(data.user?.email ?? null))
    }, [])

    const hayAsesor = telefonoAsesor.length > 0
    const mensaje = `Hola, necesito ayuda con mi cuenta de Playr.\n\nMotivo: ${razon.trim()}${correo ? `\n\nCorreo de mi cuenta: ${correo}` : ""}`
    const whatsappUrl = `https://wa.me/${telefonoAsesor}?text=${encodeURIComponent(mensaje)}`
    const puedeEnviar = hayAsesor && razon.trim().length > 0

    return (
        <Card className="h-full">
            <div id={SOPORTE_ID} className="scroll-mt-20 space-y-4">
                <SectionHeader icon={MessageCircle} title="Contactar a soporte" />

                <div className="space-y-2">
                    <p className="text-xs text-secondary font-medium">
                        Antes de contactar, verifica:
                    </p>
                    <ul className="space-y-1.5">
                        <li className="flex items-start gap-2 text-xs text-secondary">
                            <CircleCheck className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" aria-hidden="true" />
                            Que la fecha del perfil no haya vencido
                        </li>
                        <li className="flex items-start gap-2 text-xs text-secondary">
                            <CircleCheck className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" aria-hidden="true" />
                            Que no hayas modificado contraseñas ni nombres de perfiles
                        </li>
                    </ul>
                </div>

                <div className="space-y-1.5">
                    <label
                        htmlFor="razon"
                        className="text-xs text-secondary font-medium"
                    >
                        Razón del contacto
                    </label>
                    <textarea
                        id="razon"
                        value={razon}
                        onChange={(e) => setRazon(e.target.value)}
                        placeholder="Describe brevemente tu motivo..."
                        rows={3}
                        disabled={!hayAsesor}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 resize-none transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                    />
                </div>

                {!hayAsesor && (
                    <p className="text-xs text-amber-400">
                        El contacto por WhatsApp no está disponible en este momento. Inténtalo más tarde.
                    </p>
                )}

                <Button
                    variant="primary"
                    size="sm"
                    disabled={!puedeEnviar}
                    className="w-full"
                    leftIcon={<MessageCircle className="w-4 h-4" />}
                    onClick={() => {
                        if (puedeEnviar) {
                            window.open(
                                whatsappUrl,
                                "_blank",
                                "noopener,noreferrer"
                            )
                        }
                    }}
                >
                    Contactar por WhatsApp
                </Button>
            </div>
        </Card>
    )
}
