"use client"

import { useId, useState } from "react"
import { CircleCheck, Loader2, RefreshCw, TriangleAlert } from "lucide-react"
import Modal from "@ui/modal"
import Button from "@ui/button"
import Input from "@ui/input"
import Alert from "@ui/alert"
import { formatCOP } from "@lib/currency"
import { capitalizar } from "@lib/text"
import { MAX_CANTIDAD, type BodegaProducto, type ConsultaEnVivo } from "@lib/bodega/tipos"

interface ComprarModalProps {
    /** Producto con el precio vigente que se conoce (el del escaneo, o el que informó el servidor al rechazar por cambio de precio). */
    producto: BodegaProducto
    accesoLabel: string
    /** Saldo leído del proveedor; null si aún no se pudo leer (el servidor lo vuelve a verificar de todas formas). */
    saldo: number | null
    /** Momento del escaneo del que sale el precio de la tabla ("dd/mm/aaaa, hh:mm", o solo la fecha en corridas viejas). */
    escaneo: string | null
    /** Precio del producto en ese escaneo, para avisar si el de ahora es distinto. */
    precioEscaneo: number
    /** Lectura en vivo de precio, stock y saldo al abrir el modal. */
    vivo: ConsultaEnVivo | "cargando"
    onReverificar: () => void
    pending: boolean
    /** Error de la última compra: se muestra aquí para que no quede tapado por el fondo del modal. */
    error: string | null
    /** `precio` = precio unitario mostrado al confirmar: el servidor exige que siga siendo el de ahora. */
    onConfirm: (cantidad: number, precio: number) => void
    onClose: () => void
}

/** Se monta con `key={producto.listing_id}` desde el padre, así la cantidad vuelve a 1 con cada producto. */
export default function ComprarModal({
    producto, accesoLabel, saldo, escaneo, precioEscaneo, vivo, onReverificar, pending, error, onConfirm, onClose,
}: Readonly<ComprarModalProps>) {
    const ids = useId()
    const [cantidad, setCantidad] = useState("1")

    const verificando = vivo === "cargando"
    const leido = vivo !== "cargando" && vivo.ok ? vivo : null
    const fallo = vivo !== "cargando" && !vivo.ok ? vivo.error : null
    // Se confirma (y se envía) el precio que se ve: el verificado en vivo si se pudo leer; si no, el último conocido.
    const precio = leido ? leido.precio : producto.precio
    const cambioPrecio = leido !== null && leido.precio !== precioEscaneo
    const agotado = leido !== null && leido.stock === 0
    // stock null = hay stock pero el sitio no dice cuántas: solo aplica el tope por compra
    const tope = leido?.stock ? Math.min(MAX_CANTIDAD, leido.stock) : MAX_CANTIDAD

    const qty = Number(cantidad)
    const cantidadValida = !agotado && Number.isInteger(qty) && qty >= 1 && qty <= tope
    const total = cantidadValida ? precio * qty : null
    const despues = total !== null && saldo !== null ? saldo - total : null
    const insuficiente = despues !== null && despues < 0

    let ayudaCantidad: string | undefined
    if (leido?.stock) ayudaCantidad = `${leido.stock === 1 ? "Queda 1" : `Quedan ${leido.stock}`} en el proveedor`
    else if (leido && !agotado) ayudaCantidad = "Hay stock (el proveedor no informa cuántas)"

    let textoBoton = total === null ? "Comprar" : `Comprar ${formatCOP(total)}`
    if (pending) textoBoton = "Comprando..."
    else if (verificando) textoBoton = "Verificando…"
    else if (agotado) textoBoton = "Agotado ahora en el proveedor"

    return (
        <Modal isOpen title="Comprar en el proveedor" onClose={onClose} dismissible={!pending}>
            <div className="flex flex-col gap-3">
                {error && <Alert variant="error" message={error} />}

                <div className="rounded-xl border border-white/10 bg-white/3 px-4 py-3">
                    <p className="font-medium text-white">{capitalizar(producto.nombre)}</p>
                    <p className="text-xs text-secondary mt-0.5">
                        {producto.platform_nombre ? capitalizar(producto.platform_nombre) : "Combo"} · {accesoLabel}
                    </p>
                </div>

                {verificando && (
                    <p role="status" className="flex items-center gap-2 text-xs text-secondary">
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
                        Verificando precio y stock en el proveedor…
                    </p>
                )}
                {leido && !agotado && (
                    <p role="status" className="flex items-center gap-2 text-xs text-emerald-400">
                        <CircleCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                        Precio, stock y saldo verificados ahora en el proveedor.
                    </p>
                )}
                {fallo && (
                    <div role="status" className="flex items-start gap-2 text-xs text-amber-400">
                        <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                        <p className="flex-1">
                            No se pudo verificar en vivo: {fallo} Puedes comprar igual: antes de pagar, el servidor vuelve a verificar precio, stock
                            y saldo.
                        </p>
                        <Button variant="ghost" size="sm" onClick={onReverificar} disabled={pending} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>
                            Reintentar
                        </Button>
                    </div>
                )}
                {agotado && <Alert variant="error" message="Agotado ahora en el proveedor: el último escaneo lo veía en stock, pero ya no quedan unidades." />}
                {cambioPrecio && !agotado && (
                    <Alert
                        variant="warning"
                        message={`El precio cambió desde el escaneo: era ${formatCOP(precioEscaneo)} y ahora es ${formatCOP(precio)}. El total ya usa el precio de ahora.`}
                    />
                )}

                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                        <label htmlFor={`${ids}-precio`} className="text-xs text-secondary font-medium">Precio unitario</label>
                        <Input
                            id={`${ids}-precio`}
                            className="bg-white/3"
                            value={formatCOP(precio)}
                            readOnly
                            message={leido ? "Verificado ahora en el proveedor" : escaneo ? `Del escaneo del ${escaneo}` : "Del último escaneo"}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label htmlFor={`${ids}-cantidad`} className="text-xs text-secondary font-medium">Cantidad (máx. {agotado ? 0 : tope})</label>
                        <Input
                            id={`${ids}-cantidad`}
                            className="bg-white/3"
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={tope}
                            step={1}
                            value={cantidad}
                            onChange={(e) => setCantidad(e.target.value)}
                            disabled={pending || agotado}
                            message={ayudaCantidad}
                            error={cantidad !== "" && !agotado && !cantidadValida ? (tope === 1 ? "Solo 1 unidad." : `Entre 1 y ${tope}.`) : undefined}
                        />
                    </div>
                </div>

                <dl className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/3 px-4 py-3 text-sm">
                    <div className="flex items-center justify-between">
                        <dt className="text-secondary">Total a pagar</dt>
                        <dd className="font-semibold tabular-nums">{total === null ? "--" : formatCOP(total)}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                        <dt className="text-secondary">Saldo actual{leido && <span className="text-emerald-400"> · verificado ahora</span>}</dt>
                        <dd className={`tabular-nums ${saldo === null ? "text-amber-400" : ""}`}>{saldo === null ? "Saldo no verificado" : formatCOP(saldo)}</dd>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/6 pt-2">
                        <dt className="text-secondary">Saldo después</dt>
                        <dd className={`font-semibold tabular-nums ${insuficiente ? "text-red-400" : ""}`}>{despues === null ? "--" : formatCOP(despues)}</dd>
                    </div>
                </dl>

                {insuficiente && <p className="text-xs text-red-400" role="alert">El saldo no alcanza para esta cantidad.</p>}
                {saldo === null && !verificando && (
                    <p className="text-xs text-amber-400">
                        No pudimos leer el saldo todavía. Antes de pagar, el servidor lo consulta en vivo y no compra si no alcanza.
                    </p>
                )}
                <p className="text-xs text-secondary">
                    Se paga con el saldo del monedero del proveedor. Es dinero real y no se puede deshacer. Antes de pagar se vuelve a verificar
                    en vivo que el precio y el stock sigan siendo estos.
                </p>
            </div>

            <div className="flex items-center justify-end gap-2 mt-4">
                <Button variant="ghost" onClick={onClose} disabled={pending}>Cancelar</Button>
                <Button
                    variant="primary"
                    onClick={() => onConfirm(qty, precio)}
                    isLoading={pending}
                    disabled={verificando || agotado || !cantidadValida || insuficiente}
                >
                    {textoBoton}
                </Button>
            </div>
            {pending && (
                <p className="text-xs text-secondary mt-3 text-right" role="status">
                    Estamos comprando en el proveedor. No cierres esta ventana.
                </p>
            )}
        </Modal>
    )
}
