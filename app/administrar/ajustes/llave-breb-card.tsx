"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { KeyRound, Save } from "lucide-react"
import Card from "@ui/card"
import Button from "@ui/button"
import Alert from "@ui/alert"
import Input from "@ui/input"
import { SectionHeader } from "@ui/page-header"
import { validateLlaveBreb } from "@lib/pedido"
import { updateLlaveBrebAction } from "@action/admin/ajustes/update-llave-breb-action"

/** Llave Bre-B del negocio: la Tienda se la muestra al cliente para que pague antes de subir el comprobante. */
export default function LlaveBrebCard({ llaveActual }: Readonly<{ /** "" = no configurada. */ llaveActual: string }>) {
    const router = useRouter()
    const [llave, setLlave] = useState(llaveActual)
    const [error, setError] = useState<string | null>(null)
    const [aviso, setAviso] = useState<string | null>(null)
    const [guardando, startGuardar] = useTransition()

    const sinCambios = llave.trim() === llaveActual

    const guardar = (e: React.FormEvent) => {
        e.preventDefault()
        setAviso(null)
        const invalido = validateLlaveBreb(llave)
        setError(invalido)
        if (invalido) return

        startGuardar(async () => {
            const res = await updateLlaveBrebAction(llave).catch(() => ({
                ok: false as const,
                error: "No se pudo guardar la llave. Inténtalo de nuevo.",
            }))
            if (!res.ok) {
                setError(res.error)
                return
            }
            setAviso("Llave guardada. Los nuevos pagos de la Tienda ya usan esta llave.")
            router.refresh()
        })
    }

    return (
        <Card>
            <SectionHeader
                icon={KeyRound}
                title="Llave Bre-B"
                description="A esta llave pagan los clientes en la Tienda antes de subir su comprobante."
            />

            <div className="mt-6 border-t border-white/6" />

            <div className="mt-6 flex flex-col gap-4">
                <div>
                    <p className="text-xs text-secondary font-medium">Llave actual</p>
                    {llaveActual ? (
                        <p className="mt-1 text-lg font-semibold text-white break-all">{llaveActual}</p>
                    ) : (
                        <p className="mt-1 text-sm text-amber-400">Sin configurar: los clientes no pueden pagar en la Tienda.</p>
                    )}
                </div>

                <form onSubmit={guardar} noValidate className="flex flex-col gap-3">
                    <Input
                        name="llave_breb"
                        label="Nueva llave"
                        required
                        autoComplete="off"
                        placeholder="Celular, cédula, correo o @llave"
                        value={llave}
                        onChange={(e) => {
                            setLlave(e.target.value)
                            setError(null)
                        }}
                        error={error ?? undefined}
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
