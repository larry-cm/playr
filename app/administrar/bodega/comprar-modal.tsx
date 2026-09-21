"use client"

import { useState } from "react"
import Modal from "@ui/modal"
import Button from "@ui/button"
import Input from "@ui/input"
import Alert from "@ui/alert"
import { formatCOP } from "@lib/currency"
import { MAX_CANTIDAD, type BodegaProducto } from "@lib/bodega/tipos"

interface ComprarModalProps {
    producto: BodegaProducto
    accesoLabel: string
    /** Saldo leído del proveedor; null si aún no se pudo leer (el servidor lo vuelve a verificar de todas formas). */
    saldo: number | null
    pending: boolean
    /** Error de la última compra: se muestra aquí para que no quede tapado por el fondo del modal. */
    error: string | null
    onConfirm: (cantidad: number) => void
    onClose: () => void
}

/** Se monta con `key={producto.listing_id}` desde el padre, así la cantidad vuelve a 1 con cada producto. */
export default function ComprarModal({ producto, accesoLabel, saldo, pending, error, onConfirm, onClose }: Readonly<ComprarModalProps>) {
    const [cantidad, setCantidad] = useState("1")

    const qty = Number(cantidad)
    const cantidadValida = Number.isInteger(qty) && qty >= 1 && qty <= MAX_CANTIDAD
    const total = cantidadValida ? producto.precio * qty : null
    const despues = total !== null && saldo !== null ? saldo - total : null
    const insuficiente = despues !== null && despues < 0

    return (
        <Modal isOpen title="Comprar en el proveedor" onClose={() => { if (!pending) onClose() }}>
            <div className="flex flex-col gap-3">
                {error && <Alert variant="error" message={error} />}

                <div className="rounded-xl border border-white/10 bg-white/3 px-4 py-3">
                    <p className="font-medium text-white">{producto.nombre}</p>
                    <p className="text-xs text-secondary mt-0.5">
                        {producto.platform_nombre ?? "Combo"} · {accesoLabel}
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-secondary font-medium">Precio unitario</label>
                        <Input className="bg-white/3" value={formatCOP(producto.precio)} readOnly />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-secondary font-medium">Cantidad (máx. {MAX_CANTIDAD})</label>
                        <Input
                            className="bg-white/3"
                            type="number"
                            min={1}
                            max={MAX_CANTIDAD}
                            step={1}
                            value={cantidad}
                            onChange={(e) => setCantidad(e.target.value)}
                            disabled={pending}
                        />
                    </div>
                </div>

                <dl className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/3 px-4 py-3 text-sm">
                    <div className="flex items-center justify-between">
                        <dt className="text-secondary">Total a pagar</dt>
                        <dd className="font-semibold tabular-nums">{total === null ? "--" : formatCOP(total)}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                        <dt className="text-secondary">Saldo actual</dt>
                        <dd className="tabular-nums">{saldo === null ? "--" : formatCOP(saldo)}</dd>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/6 pt-2">
                        <dt className="text-secondary">Saldo después</dt>
                        <dd className={`font-semibold tabular-nums ${insuficiente ? "text-red-400" : ""}`}>{despues === null ? "--" : formatCOP(despues)}</dd>
                    </div>
                </dl>

                {insuficiente && <p className="text-xs text-red-400">El saldo no alcanza para esta cantidad.</p>}
                {producto.combo && (
                    <p className="text-xs text-secondary">
                        Este combo trae una credencial por plataforma: la entrega se separa y se registra una cuenta por cada una.
                    </p>
                )}
                {!producto.combo && producto.access_type !== "pantalla" && (
                    <p className="text-xs text-amber-400">
                        Este tipo de producto no siempre entrega un perfil con PIN. Si la entrega no se reconoce, la compra se hace igual y la
                        entrega queda pendiente de registro (se conserva en el proveedor).
                    </p>
                )}
                <p className="text-xs text-secondary">
                    Se paga con el saldo del monedero del proveedor. Es dinero real y no se puede deshacer. Antes de pagar se verifica en vivo que el
                    precio y el stock sigan siendo estos.
                </p>
            </div>

            <div className="flex items-center justify-end gap-2 mt-4">
                <Button variant="ghost" onClick={onClose} disabled={pending}>Cancelar</Button>
                <Button variant="primary" onClick={() => onConfirm(qty)} disabled={pending || !cantidadValida || insuficiente}>
                    {pending ? "Comprando..." : total === null ? "Comprar" : `Comprar ${formatCOP(total)}`}
                </Button>
            </div>
            {pending && <p className="text-xs text-secondary mt-3 text-right">Estamos comprando y registrando la entrega. No cierres esta ventana.</p>}
        </Modal>
    )
}
