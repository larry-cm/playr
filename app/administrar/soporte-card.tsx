"use client"

import { useState, useEffect } from "react"
import Card from "@ui/card"
import Button from "@ui/button"
import { MessageCircle, CircleCheck } from "lucide-react"
import { supabase } from "@lib/supabase/client"

const TELEFONO = "521234567890"

export default function SoporteCard() {
    const [razon, setRazon] = useState("")
    const [telefonoUsuario, setTelefonoUsuario] = useState<string | null>(null)

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            const phone = data.user?.user_metadata?.telefono ?? null
            setTelefonoUsuario(phone)
        })
    }, [])

    const telefono = telefonoUsuario ?? TELEFONO
    const mensaje = `Razón de contacto: ${razon}\n\nCorreo del usuario: [----/new]`
    const whatsappUrl = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`
    const puedeEnviar = razon.trim().length > 0

    return (
        <Card className="h-full">
            <div className="space-y-4">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-accent/10">
                        <MessageCircle className="w-4 h-4 text-accent" />
                    </div>
                    <h2 className="font-semibold text-sm">Contactar</h2>
                </div>

                <div className="space-y-2">
                    <p className="text-xs text-secondary font-medium">
                        Antes de contactar, verifica:
                    </p>
                    <ul className="space-y-1.5">
                        <li className="flex items-start gap-2 text-xs text-secondary">
                            <CircleCheck className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
                            Que la fecha del perfil no haya vencido
                        </li>
                        <li className="flex items-start gap-2 text-xs text-secondary">
                            <CircleCheck className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
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
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 resize-none transition-colors"
                    />
                </div>

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
