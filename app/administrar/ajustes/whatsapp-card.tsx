"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { MessageCircle, Save } from "lucide-react"
import Card from "@ui/card"
import Button from "@ui/button"
import Alert from "@ui/alert"
import PhoneInput from "@ui/phone-input"
import { SectionHeader } from "@ui/page-header"
import { formatPhoneNumber, splitPhoneNumber } from "@lib/phone"
import { validatePhone } from "@lib/validation"
import { updateWhatsappAsesorAction } from "@action/admin/ajustes/update-whatsapp-action"

/** Número de WhatsApp del asesor: a él llegan los mensajes de Soporte y los pedidos de la Tienda. */
export default function WhatsappCard({ telefonoActual }: Readonly<{ /** Solo dígitos; "" = no configurado. */ telefonoActual: string }>) {
    const router = useRouter()
    const inicial = splitPhoneNumber(telefonoActual)
    const [codigo, setCodigo] = useState(inicial.code)
    const [numero, setNumero] = useState(inicial.number)
    const [error, setError] = useState<string | null>(null)
    const [aviso, setAviso] = useState<string | null>(null)
    const [guardando, startGuardar] = useTransition()

    const sinCambios = telefonoActual.length > 0 && `${codigo}${numero}`.replace(/\D/g, "") === telefonoActual

    const guardar = (e: React.FormEvent) => {
        e.preventDefault()
        setAviso(null)
        const invalido = numero ? validatePhone(codigo, numero) : "Ingresa el número de WhatsApp."
        setError(invalido)
        if (invalido) return

        startGuardar(async () => {
            const res = await updateWhatsappAsesorAction(codigo, numero).catch(() => ({
                ok: false as const,
                error: "No se pudo guardar el número. Inténtalo de nuevo.",
            }))
            if (!res.ok) {
                setError(res.error)
                return
            }
            setAviso("Número guardado. Soporte y la Tienda ya usan el nuevo número.")
            router.refresh()
        })
    }

    return (
        <Card>
            <SectionHeader
                icon={MessageCircle}
                title="WhatsApp del asesor"
                description="A este número llegan los mensajes de Soporte y los pedidos de la Tienda."
            />

            <div className="mt-6 border-t border-white/6" />

            <div className="mt-6 flex flex-col gap-4">
                <div>
                    <p className="text-xs text-secondary font-medium">Número actual</p>
                    {telefonoActual ? (
                        <p className="mt-1 text-lg font-semibold text-white tabular-nums">{formatPhoneNumber(telefonoActual)}</p>
                    ) : (
                        <p className="mt-1 text-sm text-amber-400">
                            Sin configurar: los clientes no pueden escribir a soporte ni pedir por WhatsApp.
                        </p>
                    )}
                </div>

                <form onSubmit={guardar} noValidate className="flex flex-col gap-3">
                    <PhoneInput
                        name="whatsapp_numero"
                        label="Nuevo número"
                        required
                        codeValue={codigo}
                        numberValue={numero}
                        onCodeChange={(v) => {
                            setCodigo(v)
                            setError(null)
                        }}
                        onNumberChange={(e) => {
                            setNumero(e.target.value)
                            setError(null)
                        }}
                        numberError={error ?? undefined}
                    />

                    {aviso && <Alert variant="success" message={aviso} onDismiss={() => setAviso(null)} autoDismissMs={5000} />}

                    <div className="flex justify-end">
                        <Button type="submit" isLoading={guardando} disabled={guardando || sinCambios} leftIcon={<Save className="w-4 h-4" />}>
                            Guardar
                        </Button>
                    </div>
                </form>
            </div>
        </Card>
    )
}
