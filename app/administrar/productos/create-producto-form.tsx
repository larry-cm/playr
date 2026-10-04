"use client"

import { use, useState } from "react"
import Input from "@ui/input"
import SelectDropdown from "@ui/select-dropdown"
import Button from "@ui/button"
import type { LicenciaDisponible } from "@action/manager-and-admin/productos/get-licencias-disponibles-action"
import type { ProductoRow } from "@action/manager-and-admin/productos/get-all-productos-action"
import { createProductoAction } from "@action/manager-and-admin/productos/create-producto-action"
import { accessTypeLabel } from "@lib/access-type"
import { formatCOP } from "@lib/currency"

const ofertaKey = (platformId: number, accessType: string) => `${platformId}:${accessType}`

interface CreateProductoFormProps {
    ofertaPromise: Promise<LicenciaDisponible[] | null>
    isPending: boolean
    onPendingChange: (pending: boolean) => void
    onSuccess: (producto: ProductoRow) => void
    onError: (message: string) => void
    onCancel: () => void
}

// use() lee la misma promesa que arrancó el server component de la página (ver page.tsx): si ya se
// resolvió mientras el admin navegaba, esto no espera nada; si no, Suspense muestra el fallback sin
// disparar un scrapeo nuevo. Un solo escaneo por carga de página en vez de uno por cada apertura del modal.
export default function CreateProductoForm({ ofertaPromise, isPending, onPendingChange, onSuccess, onError, onCancel }: CreateProductoFormProps) {
    const oferta = use(ofertaPromise)
    const [selectedKey, setSelectedKey] = useState("")
    const [newPrecioVenta, setNewPrecioVenta] = useState("")

    const selectedOferta = oferta?.find((o) => ofertaKey(o.platform_id, o.access_type) === selectedKey)

    const submit = async () => {
        if (isPending || !selectedOferta) {
            onError("Selecciona un producto del proveedor.")
            return
        }
        if (newPrecioVenta === "") {
            onError("El precio de venta es obligatorio.")
            return
        }

        onPendingChange(true)
        const result = await createProductoAction({
            platform_id: selectedOferta.platform_id,
            access_type: selectedOferta.access_type,
            precio_venta: newPrecioVenta,
        }).catch(() => "No se pudo crear el producto. Inténtalo de nuevo.")
        onPendingChange(false)

        if (typeof result === "string") {
            onError(result)
            return
        }
        onSuccess(result.producto)
    }

    return (
        <>
            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-secondary font-medium">Licencia comprada</label>
                    <SelectDropdown
                        ariaLabel="Licencia comprada"
                        placeholder="Selecciona una licencia"
                        value={selectedKey}
                        onChange={setSelectedKey}
                        options={(oferta ?? []).map((o) => ({
                            value: ofertaKey(o.platform_id, o.access_type),
                            label: `${o.platform_nombre} · ${accessTypeLabel[o.access_type]}`,
                        }))}
                    />
                    {oferta === null && (
                        <p className="text-xs text-red-400">
                            No pudimos leer tus licencias en el proveedor. Intenta de nuevo en un momento.
                        </p>
                    )}
                    {oferta && oferta.length === 0 && (
                        <p className="text-xs text-secondary">
                            No tienes licencias activas sin producto todavía. Compra o renueva stock en el proveedor primero.
                        </p>
                    )}
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-secondary font-medium">Costo (proveedor)</label>
                    <Input
                        className="bg-white/3"
                        value={selectedOferta && selectedOferta.costo !== null ? formatCOP(selectedOferta.costo) : "--"}
                        readOnly
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label htmlFor="crear-producto-precio" className="text-xs text-secondary font-medium">
                        Precio de venta<span className="text-accent ml-0.5" aria-hidden="true">*</span>
                    </label>
                    {/* Igual que en Editar: texto con teclado numérico y solo dígitos (sin flechas ni "e" de type="number"). */}
                    <Input
                        id="crear-producto-precio"
                        className="bg-white/3"
                        type="text"
                        inputMode="numeric"
                        value={newPrecioVenta}
                        onChange={(e) => setNewPrecioVenta(e.target.value.replace(/\D/g, ""))}
                        required
                        message="Obligatorio: sin este precio el producto no aparece en la Tienda."
                    />
                </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
                <Button variant="ghost" onClick={onCancel} disabled={isPending}>Cancelar</Button>
                <Button variant="primary" onClick={submit} disabled={isPending || !selectedOferta}>
                    {isPending ? "Creando..." : "Crear"}
                </Button>
            </div>
        </>
    )
}

/** Mientras llega el escaneo: los mismos campos (deshabilitados) que el formulario real, así el modal no cambia de alto. */
export function CreateProductoFormSkeleton({ onCancel }: { onCancel: () => void }) {
    return (
        <>
            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-secondary font-medium">Licencia comprada</label>
                    <SelectDropdown
                        ariaLabel="Licencia comprada"
                        placeholder="Buscando licencias activas en el proveedor..."
                        value=""
                        onChange={() => {}}
                        options={[]}
                        className="animate-pulse"
                        disabled
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-secondary font-medium">Costo (proveedor)</label>
                    <Input className="bg-white/3" value="--" readOnly />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-secondary font-medium">
                        Precio de venta<span className="text-accent ml-0.5" aria-hidden="true">*</span>
                    </label>
                    <Input className="bg-white/3" value="" disabled message="Obligatorio: sin este precio el producto no aparece en la Tienda." />
                </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
                <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
                <Button variant="primary" disabled>Crear</Button>
            </div>
        </>
    )
}
