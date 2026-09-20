"use client"

import { useEffect, useState } from "react"
import Card from "@ui/card"
import Button from "@ui/button"
import Input from "@ui/input"
import Select from "@ui/select"
import Modal from "@ui/modal"
import Alert from "@ui/alert"
import { AlertCircle, Plus, Pencil, Trash2, Check, X } from "lucide-react"
import { getAllProductosAction } from "@action/manager-and-admin/productos/get-all-productos-action"
import type { ProductoRow } from "@action/manager-and-admin/productos/get-all-productos-action"
import { getLicenciasDisponiblesAction } from "@action/manager-and-admin/productos/get-licencias-disponibles-action"
import type { LicenciaDisponible } from "@action/manager-and-admin/productos/get-licencias-disponibles-action"
import { createProductoAction } from "@action/manager-and-admin/productos/create-producto-action"
import { editProductoPreciosAction } from "@action/manager-and-admin/productos/edit-producto-precios-action"
import { deleteProductoAction } from "@action/manager-and-admin/productos/delete-producto-action"
import { formatCOP } from "@lib/currency"

const accessTypeLabel: Record<ProductoRow["access_type"], string> = {
    completa: "Completa",
    pantalla: "Pantalla",
    otro: "Otro",
}

const ofertaKey = (platformId: number, accessType: string) => `${platformId}:${accessType}`

export default function ProductosClient() {
    // undefined = cargando · null = error · array = datos listos
    const [productos, setProductos] = useState<ProductoRow[] | null | undefined>(undefined)
    const [oferta, setOferta] = useState<LicenciaDisponible[] | null | undefined>(undefined)
    const [alert, setAlert] = useState<{ variant: "success" | "error"; message: string } | null>(null)
    const [isPending, setIsPending] = useState(false)

    const [createOpen, setCreateOpen] = useState(false)
    const [selectedKey, setSelectedKey] = useState("")
    const [newPrecioVenta, setNewPrecioVenta] = useState("")

    const [editingId, setEditingId] = useState<number | null>(null)
    const [editPrecioVenta, setEditPrecioVenta] = useState("")

    const [deletingId, setDeletingId] = useState<number | null>(null)

    const loadOferta = () => getLicenciasDisponiblesAction().then((rows) => setOferta(rows))

    useEffect(() => {
        let active = true
        getAllProductosAction().then((rows) => {
            if (active) setProductos(rows)
        })
        getLicenciasDisponiblesAction().then((rows) => {
            if (active) setOferta(rows)
        })
        return () => {
            active = false
        }
    }, [])

    const selectedOferta = oferta?.find((o) => ofertaKey(o.platform_id, o.access_type) === selectedKey)

    const openCreate = () => {
        setSelectedKey("")
        setNewPrecioVenta("")
        setCreateOpen(true)
        loadOferta()
    }

    const closeCreate = () => setCreateOpen(false)

    const submitCreate = async () => {
        if (isPending || !selectedOferta) {
            setAlert({ variant: "error", message: "Selecciona un producto del proveedor." })
            return
        }
        if (newPrecioVenta === "") {
            setAlert({ variant: "error", message: "El precio de venta es obligatorio." })
            return
        }

        setIsPending(true)
        setAlert(null)
        const result = await createProductoAction({
            platform_id: selectedOferta.platform_id,
            access_type: selectedOferta.access_type,
            precio_venta: newPrecioVenta,
        })
        setIsPending(false)

        if (typeof result === "string") {
            setAlert({ variant: "error", message: result })
            return
        }

        setProductos((prev) => [...(prev ?? []), result.producto])
        setOferta((prev) => (prev ?? []).filter((o) => ofertaKey(o.platform_id, o.access_type) !== selectedKey))
        setAlert({ variant: "success", message: "Producto creado correctamente." })
        closeCreate()
    }

    const openEdit = (row: ProductoRow) => {
        setEditingId(row.id)
        setEditPrecioVenta(row.precio_venta === null ? "" : String(row.precio_venta))
    }

    const cancelEdit = () => setEditingId(null)

    const saveEdit = async (id: number) => {
        if (isPending) return
        if (editPrecioVenta === "") {
            setAlert({ variant: "error", message: "El precio de venta es obligatorio." })
            return
        }

        setIsPending(true)
        setAlert(null)
        const error = await editProductoPreciosAction({ id, precio_venta: editPrecioVenta })
        setIsPending(false)

        if (error) {
            setAlert({ variant: "error", message: error })
            return
        }

        setProductos((prev) =>
            (prev ?? []).map((row) =>
                row.id === id ? { ...row, precio_venta: Number(editPrecioVenta) } : row
            )
        )
        setAlert({ variant: "success", message: "Producto actualizado correctamente." })
        setEditingId(null)
    }

    const confirmDelete = async () => {
        if (deletingId === null || isPending) return
        setIsPending(true)
        setAlert(null)
        const error = await deleteProductoAction({ id: deletingId })
        setIsPending(false)

        if (error) {
            setAlert({ variant: "error", message: error })
            return
        }

        setProductos((prev) => (prev ?? []).filter((row) => row.id !== deletingId))
        setAlert({ variant: "success", message: "Producto eliminado correctamente." })
        setDeletingId(null)
    }

    if (productos === null) {
        return (
            <Card className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400 mb-4 shadow-lg shadow-red-500/5">
                    <AlertCircle className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">Error al cargar los productos</h3>
                <p className="text-sm text-white/60 max-w-md">
                    Tuvimos un problema al obtener la información. Por favor intenta de nuevo más tarde o verifica la conexión.
                </p>
            </Card>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            {alert && (
                <Alert variant={alert.variant} message={alert.message} onDismiss={() => setAlert(null)} />
            )}

            <div className="flex justify-end">
                <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={openCreate}>
                    Agregar producto
                </Button>
            </div>

            <Card className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="text-xs text-secondary uppercase tracking-wide">
                            <th className="pb-3 pr-4">Plataforma</th>
                            <th className="pb-3 pr-4">Categoría</th>
                            <th className="pb-3 pr-4">Tipo de acceso</th>
                            <th className="pb-3 pr-4">Costo (proveedor)</th>
                            <th className="pb-3 pr-4">Precio de venta</th>
                            <th className="pb-3 pr-4">Visible</th>
                            <th className="pb-3 pr-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {productos === undefined ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <tr key={i} className="border-t border-white/6">
                                    <td className="py-3 pr-4" colSpan={7}>
                                        <div className="h-5 w-full rounded bg-white/5 animate-pulse" />
                                    </td>
                                </tr>
                            ))
                        ) : productos.length === 0 ? (
                            <tr>
                                <td className="py-8 text-center text-secondary" colSpan={7}>
                                    No hay productos configurados todavía.
                                </td>
                            </tr>
                        ) : (
                            productos.map((row) => {
                                const isEditing = editingId === row.id
                                return (
                                    <tr key={row.id} className="border-t border-white/6">
                                        <td className="py-3 pr-4 font-medium">{row.platform_nombre}</td>
                                        <td className="py-3 pr-4 text-secondary">{row.categoria}</td>
                                        <td className="py-3 pr-4 text-secondary">{accessTypeLabel[row.access_type]}</td>
                                        <td className="py-3 pr-4 text-secondary">
                                            {row.costo === null ? "--" : formatCOP(row.costo)}
                                        </td>
                                        <td className="py-3 pr-4">
                                            {isEditing ? (
                                                <Input
                                                    className="bg-white/3 w-28"
                                                    type="number"
                                                    min="0"
                                                    value={editPrecioVenta}
                                                    onChange={(e) => setEditPrecioVenta(e.target.value)}
                                                />
                                            ) : (
                                                row.precio_venta === null ? "--" : formatCOP(row.precio_venta)
                                            )}
                                        </td>
                                        <td className="py-3 pr-4">
                                            {row.precio_venta !== null ? (
                                                <span className="text-emerald-400">Sí</span>
                                            ) : (
                                                <span className="text-secondary">No</span>
                                            )}
                                        </td>
                                        <td className="py-3 pr-4">
                                            <div className="flex items-center justify-end gap-2">
                                                {isEditing ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => saveEdit(row.id)}
                                                            disabled={isPending}
                                                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15"
                                                            aria-label="Guardar"
                                                        >
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={cancelEdit}
                                                            disabled={isPending}
                                                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/3 text-secondary hover:bg-white/5"
                                                            aria-label="Cancelar"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => openEdit(row)}
                                                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/3 hover:bg-accent/10 hover:border-accent/30 hover:text-accent"
                                                            aria-label="Editar"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setDeletingId(row.id)}
                                                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-400/20 bg-red-500/10 text-red-400 hover:bg-red-500/15"
                                                            aria-label="Eliminar"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </Card>

            <Modal isOpen={createOpen} title="Agregar producto" onClose={closeCreate}>
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-secondary font-medium">Licencia comprada</label>
                        <Select
                            placeholder={oferta === undefined ? "Cargando..." : "Selecciona una licencia"}
                            value={selectedKey}
                            onChange={(e) => setSelectedKey(e.target.value)}
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
                                No tenés licencias activas sin producto todavía. Comprá o renová stock en el proveedor primero.
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
                        <label className="text-xs text-secondary font-medium">
                            Precio de venta<span className="text-accent ml-0.5">*</span>
                        </label>
                        <Input
                            className="bg-white/3"
                            type="number"
                            min="0"
                            value={newPrecioVenta}
                            onChange={(e) => setNewPrecioVenta(e.target.value)}
                            required
                        />
                        <p className="text-xs text-secondary">Obligatorio: sin este precio el producto no aparece en la Tienda.</p>
                    </div>
                </div>
                <div className="flex items-center justify-end gap-2 mt-4">
                    <Button variant="ghost" onClick={closeCreate} disabled={isPending}>Cancelar</Button>
                    <Button variant="primary" onClick={submitCreate} disabled={isPending || !selectedOferta}>
                        {isPending ? "Creando..." : "Crear"}
                    </Button>
                </div>
            </Modal>

            <Modal isOpen={deletingId !== null} title="Confirmar eliminación" onClose={() => setDeletingId(null)}>
                <div className="text-sm text-white/90">¿Eliminar este producto? Dejará de estar disponible para la venta.</div>
                <div className="flex items-center justify-end gap-2 mt-4">
                    <Button variant="ghost" onClick={() => setDeletingId(null)} disabled={isPending}>Cancelar</Button>
                    <Button variant="primary" onClick={confirmDelete} disabled={isPending}>
                        {isPending ? "Eliminando..." : "Eliminar"}
                    </Button>
                </div>
            </Modal>
        </div>
    )
}
