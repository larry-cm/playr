"use client"

import { Suspense, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Card from "@ui/card"
import Button from "@ui/button"
import Input from "@ui/input"
import CopyInput from "@ui/copy-input"
import Modal from "@ui/modal"
import Alert from "@ui/alert"
import { AlertCircle, Plus, Pencil, Trash2, Search } from "lucide-react"
import type { ProductoRow } from "@action/manager-and-admin/productos/get-all-productos-action"
import type { LicenciaDisponible } from "@action/manager-and-admin/productos/get-licencias-disponibles-action"
import CreateProductoForm, { CreateProductoFormSkeleton } from "@/app/administrar/productos/create-producto-form"
import { editProductoPreciosAction } from "@action/manager-and-admin/productos/edit-producto-precios-action"
import { deleteProductoAction } from "@action/manager-and-admin/productos/delete-producto-action"
import { formatCOP } from "@lib/currency"

const accessTypeLabel: Record<ProductoRow["access_type"], string> = {
    completa: "Completa",
    pantalla: "Pantalla",
    otro: "Otro",
}

const gananciaOf = (row: ProductoRow) =>
    row.precio_venta === null || row.costo === null ? null : row.precio_venta - row.costo

interface ProductosClientProps {
    initialProductos: ProductoRow[] | null
    ofertaPromise: Promise<LicenciaDisponible[] | null>
}

export default function ProductosClient({ initialProductos, ofertaPromise }: ProductosClientProps) {
    const router = useRouter()
    const [productos, setProductos] = useState<ProductoRow[] | null>(initialProductos)
    const [alert, setAlert] = useState<{ variant: "success" | "error"; message: string } | null>(null)
    const [isPending, setIsPending] = useState(false)

    const [createOpen, setCreateOpen] = useState(false)

    const [editingId, setEditingId] = useState<number | null>(null)
    const [editPrecioVenta, setEditPrecioVenta] = useState("")

    const [deletingId, setDeletingId] = useState<number | null>(null)
    const [search, setSearch] = useState("")

    const filteredProductos = useMemo(() => {
        const query = search.trim().toLowerCase()
        if (!query) return productos ?? []
        return (productos ?? []).filter((row) =>
            [row.platform_nombre, row.categoria, accessTypeLabel[row.access_type]]
                .some((value) => value.toLowerCase().includes(query))
        )
    }, [productos, search])

    const openCreate = () => setCreateOpen(true)
    const closeCreate = () => setCreateOpen(false)

    const handleCreated = (producto: ProductoRow) => {
        setProductos((prev) => [...(prev ?? []), producto])
        setAlert({ variant: "success", message: "Producto creado correctamente." })
        closeCreate()
        // Refresca server components: nueva data de productos y, sobre todo, un ofertaPromise nuevo
        // para la próxima apertura del modal (la licencia recién usada ya no debe volver a ofrecerse).
        router.refresh()
    }

    const editingRow = productos?.find((row) => row.id === editingId) ?? null

    const openEdit = (row: ProductoRow) => {
        setEditingId(row.id)
        setEditPrecioVenta(row.precio_venta === null ? "" : String(row.precio_venta))
    }

    const cancelEdit = () => setEditingId(null)

    const saveEdit = async () => {
        if (editingId === null || isPending) return
        const id = editingId
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
        router.refresh()
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
        router.refresh()
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

            {/* Desktop / wide: mismo marco que Table (app/ui/table.tsx) para homogeneidad visual */}
            <div className="hidden md:block relative">
                <div
                    className="overflow-hidden rounded-2xl"
                    style={{
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.012))',
                        border: '1px solid rgba(255,255,255,0.08)',
                        boxShadow: '0 8px 24px rgba(2,6,23,0.28), inset 0 1px 0 rgba(255,255,255,0.04)',
                        backdropFilter: 'blur(10px)'
                    }}
                >
                    <div className="p-4">
                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="relative w-full sm:max-w-sm">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--color-secondary)' }} />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Buscar"
                                    className="w-full rounded-xl border border-white/10 bg-white/3 py-2.5 pl-9 pr-3 text-sm text-white outline-none transition focus:border-accent/40 focus:ring-1 focus:ring-accent/20"
                                />
                            </div>

                            <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                                Agregar producto
                            </Button>
                        </div>

                        <div className="h-[480px] overflow-y-auto">
                            <table className="w-full border-collapse text-left text-sm" style={{ color: 'var(--color-foreground)' }}>
                                <thead>
                                    <tr>
                                        {["Plataforma", "Categoría", "Tipo de acceso", "Costo (proveedor)", "Precio de venta", "Ganancia"].map((column) => (
                                            <th key={column} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--color-secondary)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                                {column}
                                            </th>
                                        ))}
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--color-secondary)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                            Acciones
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {filteredProductos.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--color-secondary)' }}>
                                                No hay productos configurados todavía.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredProductos.map((row) => (
                                            <tr key={row.id} className="group transition-colors hover:bg-white/3">
                                                <td className="px-4 py-4 align-middle font-semibold" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{row.platform_nombre}</td>
                                                <td className="px-4 py-4 align-middle" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--color-secondary)' }}>{row.categoria}</td>
                                                <td className="px-4 py-4 align-middle" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--color-secondary)' }}>{accessTypeLabel[row.access_type]}</td>
                                                <td className="px-4 py-4 align-middle" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--color-secondary)' }}>
                                                    {row.costo === null ? "--" : formatCOP(row.costo)}
                                                </td>
                                                <td className="px-4 py-4 align-middle" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                    {row.precio_venta === null ? "--" : formatCOP(row.precio_venta)}
                                                </td>
                                                <td className="px-4 py-4 align-middle font-medium" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: gananciaOf(row) === null ? 'var(--color-secondary)' : gananciaOf(row)! > 0 ? '#34d399' : gananciaOf(row)! < 0 ? '#f87171' : 'var(--color-secondary)' }}>
                                                    {gananciaOf(row) === null ? "--" : formatCOP(gananciaOf(row)!)}
                                                </td>
                                                <td className="px-4 py-4 align-middle text-right" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <div className="inline-flex items-center gap-2 *:cursor-pointer">
                                                        <button
                                                            type="button"
                                                            onClick={() => openEdit(row)}
                                                            aria-label="Editar"
                                                            title="Editar"
                                                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/3 text-(--color-foreground) transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-(--color-accent) focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setDeletingId(row.id)}
                                                            aria-label="Eliminar"
                                                            title="Eliminar"
                                                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-400/20 bg-red-500/10 text-red-400 transition-all duration-200 hover:border-red-400/30 hover:bg-red-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/25"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile: mismo marco que Table (app/ui/table.tsx) */}
            <div className="md:hidden flex flex-col gap-3">
                <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/3 p-3">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--color-secondary)' }} />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar"
                            className="w-full rounded-xl border border-white/10 bg-white/3 py-2.5 pl-9 pr-3 text-sm text-white outline-none transition focus:border-accent/40 focus:ring-1 focus:ring-accent/20"
                        />
                    </div>
                    <Button size="sm" variant="primary" onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
                        Agregar producto
                    </Button>
                </div>

                <div className="h-[480px] overflow-y-auto flex flex-col gap-3">
                    {filteredProductos.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--color-secondary)' }}>No hay productos configurados todavía.</div>
                    ) : (
                        filteredProductos.map((row) => (
                            <div key={row.id} className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 6px 16px rgba(2,6,23,0.25)' }}>
                                <div className="p-4">
                                    {[
                                        ["Plataforma", row.platform_nombre],
                                        ["Categoría", row.categoria],
                                        ["Tipo de acceso", accessTypeLabel[row.access_type]],
                                        ["Costo (proveedor)", row.costo === null ? "--" : formatCOP(row.costo)],
                                        ["Precio de venta", row.precio_venta === null ? "--" : formatCOP(row.precio_venta)],
                                    ].map(([label, value]) => (
                                        <div key={label} className="flex items-start justify-between gap-3 py-2">
                                            <div className="text-xs font-medium" style={{ color: 'var(--color-secondary)' }}>{label}</div>
                                            <div className="text-sm" style={{ color: 'var(--color-foreground)' }}>{value}</div>
                                        </div>
                                    ))}
                                    <div className="flex items-start justify-between gap-3 py-2">
                                        <div className="text-xs font-medium" style={{ color: 'var(--color-secondary)' }}>Ganancia</div>
                                        <div className="text-sm font-medium" style={{ color: gananciaOf(row) === null ? 'var(--color-secondary)' : gananciaOf(row)! > 0 ? '#34d399' : gananciaOf(row)! < 0 ? '#f87171' : 'var(--color-secondary)' }}>
                                            {gananciaOf(row) === null ? "--" : formatCOP(gananciaOf(row)!)}
                                        </div>
                                    </div>
                                    <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3 *:cursor-pointer">
                                        <button
                                            type="button"
                                            onClick={() => openEdit(row)}
                                            className="inline-flex h-9 items-center justify-center rounded-xl border border-white/10 bg-white/3 px-3 text-sm text-(--color-foreground) transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-(--color-accent)"
                                        >
                                            <Pencil className="mr-2 h-4 w-4" />Editar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDeletingId(row.id)}
                                            className="inline-flex h-9 items-center justify-center rounded-xl border border-red-400/20 bg-red-500/10 px-3 text-sm text-red-400 transition-all duration-200 hover:border-red-400/30 hover:bg-red-500/15"
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />Eliminar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <Modal isOpen={createOpen} title="Agregar producto" onClose={closeCreate}>
                <Suspense fallback={<CreateProductoFormSkeleton onCancel={closeCreate} />}>
                    <CreateProductoForm
                        ofertaPromise={ofertaPromise}
                        isPending={isPending}
                        onPendingChange={setIsPending}
                        onSuccess={handleCreated}
                        onError={(message) => setAlert({ variant: "error", message })}
                        onCancel={closeCreate}
                    />
                </Suspense>
            </Modal>

            <Modal isOpen={editingId !== null} title="Editar producto" onClose={cancelEdit}>
                {editingRow && (
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-secondary font-medium">Plataforma</label>
                            <CopyInput value={editingRow.platform_nombre} readOnly copyLabel="Copiar" successLabel="Copiado" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-secondary font-medium">Categoría</label>
                            <CopyInput value={editingRow.categoria} readOnly copyLabel="Copiar" successLabel="Copiado" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-secondary font-medium">Tipo de acceso</label>
                            <CopyInput value={accessTypeLabel[editingRow.access_type]} readOnly copyLabel="Copiar" successLabel="Copiado" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-secondary font-medium">Costo (proveedor)</label>
                            <CopyInput value={editingRow.costo === null ? "--" : formatCOP(editingRow.costo)} readOnly copyLabel="Copiar" successLabel="Copiado" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-secondary font-medium">Precio de venta</label>
                            <Input
                                className="bg-white/3"
                                type="number"
                                min="0"
                                value={editPrecioVenta}
                                onChange={(e) => setEditPrecioVenta(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2 mt-2">
                            <Button variant="ghost" onClick={cancelEdit} disabled={isPending}>Cancelar</Button>
                            <Button variant="primary" onClick={saveEdit} disabled={isPending}>
                                {isPending ? "Guardando..." : "Guardar"}
                            </Button>
                        </div>
                    </div>
                )}
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
