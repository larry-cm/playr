"use client"

import { useId, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, CircleCheck, Download, FileUp, Send } from "lucide-react"
import Modal from "@ui/modal"
import Button from "@ui/button"
import Alert from "@ui/alert"
import CopyInput from "@ui/copy-input"
import { formatCOP } from "@lib/currency"
import { COMPROBANTE_ACCEPT, rutaComprobante, tipoComprobante, validateComprobante } from "@lib/pedido"
import { supabaseTabListo } from "@lib/supabase/client"
import { crearPedidoAction } from "@action/tienda/crear-pedido-action"
import { TIPO_ACCESO } from "@/app/administrar/tienda/product-card"
import type { CatalogoDisponibleItem } from "@action/tienda/get-catalogo-disponible-action"

/** Llave visible para el cliente (sin el estado: solo le llegan las activas). */
export interface LlavePago {
    id: number
    nombre: string
    llave: string
    /** Sale ya seleccionada (la elige el admin en Ajustes). */
    predeterminada: boolean
    /** QR de la llave (lo sube el admin en Ajustes); null = sin QR, solo se copia la llave. */
    qr_url: string | null
}

interface PagoBrebModalProps {
    isOpen: boolean
    onClose: () => void
    items: CatalogoDisponibleItem[]
    total: number
    /** Al menos una. Con varias, el cliente elige a cuál transfiere. */
    llaves: LlavePago[]
    /** Se llama al registrar el pedido (la Tienda limpia la selección). */
    onPedido: () => void
}

/**
 * Pago por Bre-B: el cliente elige una de las llaves del negocio, le transfiere el total, sube el comprobante (a su carpeta del bucket privado) y
 * queda el pedido por verificar con los perfiles reservados. El precio que manda es el de la base, no el de acá.
 */
export default function PagoBrebModal({ isOpen, onClose, items, total, llaves, onPedido }: Readonly<PagoBrebModalProps>) {
    const router = useRouter()
    const fileId = useId()
    const [elegida, setElegida] = useState<number | null>(null)
    // Con una sola llave no hay nada que elegir; si no, sale marcada la predeterminada hasta que el cliente elija otra.
    // Si la elegida desaparece (el admin la ocultó), vuelve a la predeterminada o se pide elegir.
    const llave = llaves.length === 1 ? llaves[0] : (llaves.find((l) => l.id === elegida) ?? llaves.find((l) => l.predeterminada) ?? null)
    const [archivo, setArchivo] = useState<File | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [enviando, setEnviando] = useState(false)
    const [pedidoId, setPedidoId] = useState<number | null>(null)

    const cerrar = () => {
        if (enviando) return
        setArchivo(null)
        setError(null)
        setPedidoId(null)
        setElegida(null)
        onClose()
    }

    const enviar = async (e: React.FormEvent) => {
        e.preventDefault()
        const invalido = llave ? validateComprobante(archivo) : "Elige la llave a la que transferiste."
        setError(invalido)
        if (invalido || !archivo || !llave) return

        setEnviando(true)
        try {
            const supabase = await supabaseTabListo()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                setError("Tu sesión expiró. Vuelve a iniciar sesión.")
                return
            }
            const ruta = rutaComprobante(user.id, archivo)
            const { error: errSubida } = await supabase.storage.from("comprobantes").upload(ruta, archivo, { contentType: tipoComprobante(archivo), upsert: false })
            if (errSubida) {
                // La RLS del bucket corta a los 5 comprobantes sin pedido en un día (cada intento fallido deja uno).
                setError(/row-level security/i.test(errSubida.message)
                    ? "Ya subiste varios comprobantes hoy sin completar el pedido. Escríbenos por el chat con el asesor y te ayudamos."
                    : "No se pudo subir el comprobante. Revisa tu conexión e inténtalo de nuevo.")
                return
            }
            const res = await crearPedidoAction(items.map((i) => i.profile_id), ruta, total, llave.id)
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
                    {llaves.length === 1 ? (
                        <p className="text-sm text-white">
                            <b>1.</b> Desde Nequi, tu banco o cualquier app con Bre-B, transfiere <b>{formatCOP(total)}</b> a esta llave:
                        </p>
                    ) : (
                        <>
                            <p id={`${fileId}-llaves`} className="text-sm text-white">
                                <b>1.</b> Elige a qué llave quieres transferir <b>{formatCOP(total)}</b> (desde Nequi, tu banco o cualquier app con Bre-B):
                            </p>
                            <div role="radiogroup" aria-labelledby={`${fileId}-llaves`} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {llaves.map((l) => {
                                    const activa = llave?.id === l.id
                                    return (
                                        <button
                                            key={l.id}
                                            type="button"
                                            role="radio"
                                            aria-checked={activa}
                                            onClick={() => {
                                                setElegida(l.id)
                                                setError(null)
                                            }}
                                            className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                                                activa ? "border-accent/60 bg-accent/10" : "border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5"
                                            }`}
                                        >
                                            <span
                                                className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${activa ? "border-accent bg-accent" : "border-white/30"}`}
                                                aria-hidden="true"
                                            >
                                                {activa && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block text-sm font-medium text-white">{l.nombre}</span>
                                                <span className="block break-all font-mono text-xs text-secondary">{l.llave}</span>
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        </>
                    )}
                    {llave?.qr_url && (
                        <div className="flex flex-col items-center gap-3 rounded-xl border border-white/8 bg-white/3 p-3 sm:flex-row sm:items-center">
                            <div className="shrink-0 rounded-xl bg-white p-2">
                                {/* eslint-disable-next-line @next/next/no-img-element -- imagen pública de Supabase Storage */}
                                <img src={llave.qr_url} alt={`QR Bre-B de ${llave.nombre}`} className="h-40 w-40 object-contain" />
                            </div>
                            <div className="flex flex-col gap-2 text-center text-sm text-secondary sm:text-left">
                                <p>
                                    <b className="text-white">Escanéalo</b> desde tu app (Pagar con QR), o guárdalo y ábrelo desde la galería. Luego escribe el
                                    monto: <b className="text-white">{formatCOP(total)}</b>.
                                </p>
                                <a
                                    href={`${llave.qr_url}?download=${encodeURIComponent(`QR Bre-B ${llave.nombre}.${llave.qr_url.split(".").pop()}`)}`}
                                    className="inline-flex items-center justify-center gap-1.5 self-center rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 sm:self-start"
                                >
                                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                                    Guardar QR
                                </a>
                            </div>
                        </div>
                    )}
                    {llave && (
                        <CopyInput label={`${llave.qr_url ? "O copia la llave" : "Llave Bre-B"} · ${llave.nombre}`} value={llave.llave} readOnly copyLabel="Copiar llave" />
                    )}
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
