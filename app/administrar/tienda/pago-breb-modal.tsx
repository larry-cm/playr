"use client"

import { useId, useState } from "react"
import { useRouter } from "next/navigation"
import { CircleCheck, FileUp, Send } from "lucide-react"
import Modal from "@ui/modal"
import Button from "@ui/button"
import Alert from "@ui/alert"
import CopyInput from "@ui/copy-input"
import { formatCOP } from "@lib/currency"
import { COMPROBANTE_ACCEPT, rutaComprobante, validateComprobante } from "@lib/pedido"
import { supabase } from "@lib/supabase/client"
import { crearPedidoAction } from "@action/tienda/crear-pedido-action"
import { TIPO_ACCESO } from "@/app/administrar/tienda/product-card"
import type { CatalogoDisponibleItem } from "@action/tienda/get-catalogo-disponible-action"

interface PagoBrebModalProps {
    isOpen: boolean
    onClose: () => void
    items: CatalogoDisponibleItem[]
    total: number
    llave: string
    /** Se llama al registrar el pedido (la Tienda limpia la selección). */
    onPedido: () => void
}

/**
 * Pago por Bre-B: el cliente transfiere el total a la llave, sube el comprobante (a su carpeta del bucket privado) y
 * queda el pedido por verificar con los perfiles reservados. El precio que manda es el de la base, no el de acá.
 */
export default function PagoBrebModal({ isOpen, onClose, items, total, llave, onPedido }: Readonly<PagoBrebModalProps>) {
    const router = useRouter()
    const fileId = useId()
    const [archivo, setArchivo] = useState<File | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [enviando, setEnviando] = useState(false)
    const [pedidoId, setPedidoId] = useState<number | null>(null)

    const cerrar = () => {
        if (enviando) return
        setArchivo(null)
        setError(null)
        setPedidoId(null)
        onClose()
    }

    const enviar = async (e: React.FormEvent) => {
        e.preventDefault()
        const invalido = validateComprobante(archivo)
        setError(invalido)
        if (invalido || !archivo) return

        setEnviando(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                setError("Tu sesión expiró. Vuelve a iniciar sesión.")
                return
            }
            const ruta = rutaComprobante(user.id, archivo)
            const { error: errSubida } = await supabase.storage.from("comprobantes").upload(ruta, archivo, { contentType: archivo.type, upsert: false })
            if (errSubida) {
                setError("No se pudo subir el comprobante. Revisa tu conexión e inténtalo de nuevo.")
                return
            }
            const res = await crearPedidoAction(items.map((i) => i.profile_id), ruta, total)
            if (!res.ok) {
                setError(res.error)
                return
            }
            setPedidoId(res.id)
            onPedido()
            router.refresh()
        } catch {
            setError("No se pudo registrar el pago. Inténtalo de nuevo.")
        } finally {
            setEnviando(false)
        }
    }

    if (pedidoId !== null) {
        return (
            <Modal isOpen={isOpen} title="Pago enviado" onClose={cerrar}>
                <div className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                        <CircleCheck className="h-7 w-7" aria-hidden="true" />
                    </div>
                    <p className="text-white font-semibold">Recibimos tu comprobante (pedido #{pedidoId})</p>
                    <p className="text-sm text-secondary">
                        Vamos a verificar el pago. Cuando lo aprobemos verás los datos de acceso en <b className="text-white">Mis compras</b>.
                    </p>
                    <div className="mt-2 flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button variant="secondary" onClick={cerrar}>Seguir comprando</Button>
                        <Button onClick={() => { cerrar(); router.push("/administrar/compras") }}>Ver mis compras</Button>
                    </div>
                </div>
            </Modal>
        )
    }

    return (
        <Modal isOpen={isOpen} title="Pagar con Bre-B" onClose={cerrar} dismissible={!enviando}>
            <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
                <ul className="flex flex-col gap-1.5 rounded-xl border border-white/8 bg-white/3 p-3 text-sm">
                    {items.map((i) => (
                        <li key={i.profile_id} className="flex justify-between gap-3">
                            <span className="min-w-0 truncate text-secondary">
                                {i.platform_nombre} · {TIPO_ACCESO[i.access_type]} · {i.perfil_nombre}
                            </span>
                            <span className="shrink-0 text-white tabular-nums">{formatCOP(i.precio_venta)}</span>
                        </li>
                    ))}
                    <li className="mt-1 flex justify-between border-t border-white/8 pt-2 font-semibold text-white">
                        <span>Total</span>
                        <span className="tabular-nums">{formatCOP(total)}</span>
                    </li>
                </ul>

                <div className="flex flex-col gap-2">
                    <p className="text-sm text-white">
                        <b>1.</b> Desde Nequi, tu banco o cualquier app con Bre-B, transfiere <b>{formatCOP(total)}</b> a esta llave:
                    </p>
                    <CopyInput label="Llave Bre-B" value={llave} readOnly copyLabel="Copiar llave" />
                </div>

                <div className="flex flex-col gap-2">
                    <label htmlFor={fileId} className="text-sm text-white">
                        <b>2.</b> Sube la captura o el PDF del comprobante (máx. 5 MB):
                    </label>
                    <label
                        htmlFor={fileId}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/3 px-4 py-3 text-sm text-secondary transition hover:border-accent/40 hover:text-white"
                    >
                        <FileUp className="h-5 w-5 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 truncate">{archivo ? archivo.name : "Elegir archivo"}</span>
                    </label>
                    <input
                        id={fileId}
                        type="file"
                        accept={COMPROBANTE_ACCEPT}
                        className="sr-only"
                        onChange={(e) => {
                            setArchivo(e.target.files?.[0] ?? null)
                            setError(null)
                        }}
                    />
                </div>

                {error && <Alert variant="error" message={error} />}

                <p className="text-xs text-secondary">
                    Los perfiles quedan apartados para ti mientras verificamos el pago. Si no podemos confirmarlo, el pedido se rechaza y
                    vuelven a la Tienda.
                </p>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="secondary" onClick={cerrar} disabled={enviando}>Cancelar</Button>
                    <Button type="submit" isLoading={enviando} disabled={enviando} leftIcon={<Send className="h-4 w-4" />}>
                        Enviar comprobante
                    </Button>
                </div>
            </form>
        </Modal>
    )
}
