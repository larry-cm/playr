"use client"

import { useState } from "react"
import Input from "@ui/input"
import SelectDropdown from "@ui/select-dropdown"
import Button from "@ui/button"
import { Plus, X } from "lucide-react"
import type { OfertaProveedorItem } from "@action/manager-and-admin/productos/get-oferta-proveedor-action"
import type { ProductoRow } from "@action/manager-and-admin/productos/get-all-productos-action"
import { createComboAction } from "@action/manager-and-admin/productos/create-combo-action"
import { accessTypeLabel } from "@lib/access-type"
import { formatCOP } from "@lib/currency"

const ofertaKey = (o: { platform_id: number; access_type: string }) => `${o.platform_id}:${o.access_type}`

interface ItemDraft {
    key: string
    cantidad: string
}

interface CreateComboFormProps {
    oferta: OfertaProveedorItem[]
    isPending: boolean
    onPendingChange: (pending: boolean) => void
    onSuccess: (producto: ProductoRow) => void
    onError: (message: string) => void
    onCancel: () => void
}

/**
 * Un combo agrupa pantallas o cuentas de VARIAS plataformas bajo un nombre y un precio propios.
 * A diferencia del producto simple no nace de una licencia ya comprada: se arma eligiendo qué vende
 * el proveedor (business.oferta_proveedor), y de ahí sale también el costo — nunca se tipea a mano.
 */
export default function CreateComboForm({ oferta, isPending, onPendingChange, onSuccess, onError, onCancel }: CreateComboFormProps) {
    const [nombre, setNombre] = useState("")
    const [precioVenta, setPrecioVenta] = useState("")
    const [items, setItems] = useState<ItemDraft[]>([{ key: "", cantidad: "1" }, { key: "", cantidad: "1" }])

    const ofertaByKey = new Map(oferta.map((o) => [ofertaKey(o), o]))
    const elegidas = items.map((item) => ofertaByKey.get(item.key)).filter((o) => o !== undefined)

    // Una misma plataforma no se repite entre filas: para llevar dos pantallas de la misma marca
    // está la cantidad (es también la regla que valida createComboSchema del lado del servidor).
    const optionsFor = (index: number) => {
        const usadas = new Set(
            items.flatMap((item, i) => (i === index ? [] : [ofertaByKey.get(item.key)?.platform_id]))
        )
        return oferta
            .filter((o) => !usadas.has(o.platform_id) || ofertaKey(o) === items[index].key)
            .map((o) => ({ value: ofertaKey(o), label: `${o.platform_nombre} · ${accessTypeLabel[o.access_type]}` }))
    }

    const costoTotal = items.reduce<number | null>((total, item) => {
        if (total === null) return null
        const encontrada = ofertaByKey.get(item.key)
        if (!encontrada) return total
        if (encontrada.costo === null) return null
        return total + Number(encontrada.costo) * (Number(item.cantidad) || 0)
    }, 0)

    const setItem = (index: number, patch: Partial<ItemDraft>) =>
        setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))

    const addItem = () => setItems((prev) => [...prev, { key: "", cantidad: "1" }])
    const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index))

    const submit = async () => {
        if (isPending) return
        if (nombre.trim() === "") {
            onError("Ponle un nombre al combo.")
            return
        }
        if (elegidas.length < 2) {
            onError("Un combo agrupa al menos dos plataformas distintas.")
            return
        }
        if (precioVenta === "") {
            onError("El precio de venta es obligatorio.")
            return
        }

        onPendingChange(true)
        const result = await createComboAction({
            nombre,
            precio_venta: precioVenta,
            items: items
                .filter((item) => ofertaByKey.has(item.key))
                .map((item) => {
                    const encontrada = ofertaByKey.get(item.key)!
                    return {
                        platform_id: encontrada.platform_id,
                        access_type: encontrada.access_type,
                        cantidad: item.cantidad,
                    }
                }),
        })
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
                    <label className="text-xs text-secondary font-medium">
                        Nombre del combo<span className="text-accent ml-0.5">*</span>
                    </label>
                    <Input
                        className="bg-white/3"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        placeholder="Combo Familiar"
                        required
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-xs text-secondary font-medium">
                        Qué incluye<span className="text-accent ml-0.5">*</span>
                    </label>
                    {oferta.length === 0 && (
                        <p className="text-xs text-secondary">
                            Todavía no hay catálogo del proveedor escaneado, así que no hay de qué armar un combo.
                        </p>
                    )}
                    {items.map((item, index) => (
                        <div key={index} className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                                <SelectDropdown
                                    placeholder="Selecciona una plataforma"
                                    value={item.key}
                                    onChange={(value) => setItem(index, { key: value })}
                                    options={optionsFor(index)}
                                />
                            </div>
                            <input
                                type="number"
                                min="1"
                                max="20"
                                aria-label="Cantidad"
                                value={item.cantidad}
                                onChange={(e) => setItem(index, { cantidad: e.target.value })}
                                className="w-20 shrink-0 rounded-xl border border-white/10 bg-white/5 py-2.5 px-3 text-sm text-white outline-none transition focus:border-accent focus:ring-1 focus:ring-accent/40"
                            />
                            <button
                                type="button"
                                onClick={() => removeItem(index)}
                                disabled={items.length <= 2}
                                aria-label="Quitar"
                                title="Quitar"
                                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-red-400/20 bg-red-500/10 text-red-400 transition-all duration-200 hover:border-red-400/30 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                    <div>
                        <Button size="sm" variant="secondary" onClick={addItem} leftIcon={<Plus className="h-4 w-4" />}>
                            Agregar plataforma
                        </Button>
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs text-secondary font-medium">Costo (proveedor)</label>
                    <Input
                        className="bg-white/3"
                        value={costoTotal === null || elegidas.length === 0 ? "--" : formatCOP(costoTotal)}
                        readOnly
                    />
                    <p className="text-xs text-secondary">Se calcula sumando lo que cuesta cada plataforma incluida.</p>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs text-secondary font-medium">
                        Precio de venta<span className="text-accent ml-0.5">*</span>
                    </label>
                    <Input
                        className="bg-white/3"
                        type="number"
                        min="0"
                        value={precioVenta}
                        onChange={(e) => setPrecioVenta(e.target.value)}
                        required
                    />
                </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
                <Button variant="ghost" onClick={onCancel} disabled={isPending}>Cancelar</Button>
                <Button variant="primary" onClick={submit} disabled={isPending || elegidas.length < 2}>
                    {isPending ? "Creando..." : "Crear combo"}
                </Button>
            </div>
        </>
    )
}
