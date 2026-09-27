"use client"

import { Suspense, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Card from "@ui/card"
import Button from "@ui/button"
import Input from "@ui/input"
import CopyInput from "@ui/copy-input"
import Modal from "@ui/modal"
import Alert from "@ui/alert"
import { AlertCircle, Plus, Pencil, Trash2, Eye, RefreshCw } from "lucide-react"
import { ActionsCell, ActionsTh, EmptyRow, IconAction, MobileAction, MobileCard, MobileEmpty, MobileFrame, ROW_CLASS, SearchInput, SkeletonCards, SkeletonRows, TableFrame, Td, Th } from "@ui/data-frame"
import type { ProductoRow } from "@action/manager-and-admin/productos/get-all-productos-action"
import type { LicenciaDisponible } from "@action/manager-and-admin/productos/get-licencias-disponibles-action"
import type { OfertaProveedorItem } from "@action/manager-and-admin/productos/get-oferta-proveedor-action"
import CreateProductoForm, { CreateProductoFormSkeleton } from "@/app/administrar/productos/create-producto-form"
import CreateComboForm from "@/app/administrar/productos/create-combo-form"
import { editProductoPreciosAction } from "@action/manager-and-admin/productos/edit-producto-precios-action"
import { deleteProductoAction } from "@action/manager-and-admin/productos/delete-producto-action"
import { accessTypeLabel } from "@lib/access-type"
import { formatCOP } from "@lib/currency"

/** Qué lleva adentro un combo, en una línea: "2 × NETFLIX Pantalla + DISNEY Pantalla". */
const contenidoDeCombo = (row: ProductoRow) =>
    row.combo_items
        .map((item) => `${item.cantidad > 1 ? `${item.cantidad} × ` : ""}${item.platform_nombre} ${accessTypeLabel[item.access_type]}`)
        .join(" + ")

const gananciaOf = (row: ProductoRow) =>
    row.precio_venta === null || row.costo === null ? null : row.precio_venta - row.costo

const gananciaColor = (ganancia: number | null) =>
    ganancia === null || ganancia === 0
        ? 'var(--color-foreground)'
        : ganancia > 0
            ? '#34d399'
            : '#f87171'

/** Campos de solo lectura del producto, en el orden en que se muestran en Ver y en Editar. */
const camposDeProducto = (row: ProductoRow): [string, string][] => [
    [row.access_type === "combo" ? "Nombre del combo" : "Plataforma", row.titulo],
    ...(row.combo_items.length > 0 ? [["Incluye", contenidoDeCombo(row)] as [string, string]] : []),
    ["Categoría", row.categoria],
    ["Tipo de acceso", accessTypeLabel[row.access_type]],
    ["Costo (proveedor)", row.costo === null ? "--" : formatCOP(row.costo)],
]

/** Mientras la página carga no hay escaneo de licencias: el formulario (que no se puede abrir) quedaría en su esqueleto. */
const SIN_LICENCIAS = new Promise<LicenciaDisponible[] | null>(() => {})
const SIN_OFERTA: OfertaProveedorItem[] = []

const COLUMNAS = ["Producto", "Tipo de acceso", "Costo (proveedor)", "Precio de venta", "Ganancia"]

interface ProductosClientProps {
    /** undefined = la página aún carga (loading.tsx) · null = error */
    initialProductos: ProductoRow[] | null | undefined
    /** Licencias ya compradas sin producto: la base del producto simple (escaneo lento del proveedor). */
    licenciasPromise?: Promise<LicenciaDisponible[] | null>
    /** Lo que el proveedor vende hoy según el último escaneo del cron: la base de los combos. */
    oferta?: OfertaProveedorItem[]
}

export default function ProductosClient({ initialProductos, licenciasPromise = SIN_LICENCIAS, oferta = SIN_OFERTA }: ProductosClientProps) {
    const router = useRouter()
    const [productos, setProductos] = useState<ProductoRow[] | null | undefined>(initialProductos)
    // Cuando el servidor manda datos nuevos (Reintentar, o el revalidatePath de una acción) mandan esos.
    const [prevInitial, setPrevInitial] = useState(initialProductos)
    if (initialProductos !== prevInitial) {
        setPrevInitial(initialProductos)
        setProductos(initialProductos)
    }
    const [alert, setAlert] = useState<{ variant: "success" | "error"; message: string } | null>(null)
    /** Error de la operación del modal abierto: se muestra dentro del modal, no detrás del fondo. */
    const [modalError, setModalError] = useState<string | null>(null)
    const [isPending, setIsPending] = useState(false)
    const [reintentando, startReintento] = useTransition()

    const [createOpen, setCreateOpen] = useState(false)
    const [createTipo, setCreateTipo] = useState<"simple" | "combo">("simple")

    const [viewingId, setViewingId] = useState<number | null>(null)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editPrecioVenta, setEditPrecioVenta] = useState("")

    const [deletingId, setDeletingId] = useState<number | null>(null)
    const [search, setSearch] = useState("")

    const filteredProductos = useMemo(() => {
        const query = search.trim().toLowerCase()
        if (!query) return productos ?? []
        return (productos ?? []).filter((row) =>
            // Un combo también se encuentra buscando cualquiera de las plataformas que incluye.
            [row.titulo, row.categoria, accessTypeLabel[row.access_type], contenidoDeCombo(row)]
                .some((value) => value.toLowerCase().includes(query))
        )
    }, [productos, search])

    const openCreate = () => {
        setCreateTipo("simple")
        setModalError(null)
        setCreateOpen(true)
    }
    const closeCreate = () => {
        setCreateOpen(false)
        setModalError(null)
    }

    const handleCreated = (producto: ProductoRow) => {
        setProductos((prev) => [...(prev ?? []), producto])
        setAlert({ variant: "success", message: "Producto creado correctamente." })
        closeCreate()
        // Aquí sí se refresca: la promesa de licencias (escaneo en vivo del proveedor) tiene que ser nueva para la
        // próxima apertura del modal, o la licencia recién usada se volvería a ofrecer.
        router.refresh()
    }

    const viewingRow = productos?.find((row) => row.id === viewingId) ?? null
    const editingRow = productos?.find((row) => row.id === editingId) ?? null
    const deletingRow = productos?.find((row) => row.id === deletingId) ?? null

    const openEdit = (row: ProductoRow) => {
        setModalError(null)
        setEditingId(row.id)
        setEditPrecioVenta(row.precio_venta === null ? "" : String(row.precio_venta))
    }

    const cancelEdit = () => {
        setEditingId(null)
        setModalError(null)
    }

    // Editar y eliminar actualizan la tabla en local, sin router.refresh(): refrescar vuelve a renderizar la página y con
    // ella el escaneo en vivo de licencias al proveedor (lento), que estos cambios no necesitan.
    const saveEdit = async () => {
        if (editingId === null || isPending) return
        const id = editingId
        if (editPrecioVenta === "") {
            setModalError("El precio de venta es obligatorio.")
            return
        }

        setIsPending(true)
        setModalError(null)
        setAlert(null)
        const error = await editProductoPreciosAction({ id, precio_venta: editPrecioVenta }).catch(() => "No se pudo guardar el producto. Inténtalo de nuevo.")
        setIsPending(false)

        if (error) {
            setModalError(error)
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

    const openDelete = (id: number) => {
        setModalError(null)
        setDeletingId(id)
    }

    const cancelDelete = () => {
        setDeletingId(null)
        setModalError(null)
    }

    const confirmDelete = async () => {
        if (deletingId === null || isPending) return
        const id = deletingId
        setIsPending(true)
        setModalError(null)
        setAlert(null)
        const error = await deleteProductoAction({ id }).catch(() => "No se pudo eliminar el producto. Inténtalo de nuevo.")
        setIsPending(false)

        if (error) {
            setModalError(error)
            return
        }

        setProductos((prev) => (prev ?? []).filter((row) => row.id !== id))
        setAlert({ variant: "success", message: "Producto eliminado correctamente." })
        setDeletingId(null)
    }

    if (productos === null) {
        return (
            <Card padding="px-4 py-12" className="flex flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400 mb-4 shadow-lg shadow-red-500/5">
                    <AlertCircle className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">Error al cargar los productos</h3>
                <p className="text-sm text-white/60 max-w-md">
                    Tuvimos un problema al obtener la información. Verifica la conexión e inténtalo de nuevo.
                </p>
                <Button variant="secondary" className="mt-4" isLoading={reintentando} onClick={() => startReintento(() => router.refresh())} leftIcon={<RefreshCw className="h-4 w-4" />}>
                    Reintentar
                </Button>
            </Card>
        )
    }

    const toolbar = (mobile: boolean) => (
        <>
            <SearchInput value={search} onChange={setSearch} className={mobile ? "w-full" : undefined} />
            <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate} disabled={productos === undefined}>
                Agregar producto
            </Button>
        </>
    )

    return (
        <div className="flex flex-col gap-4">
            {alert && (
                <Alert variant={alert.variant} message={alert.message} onDismiss={() => setAlert(null)} autoDismissMs={alert.variant === "success" ? 5000 : undefined} />
            )}

            {/* Marco, densidad y alto compartidos con el resto de tablas del panel (app/ui/data-frame.tsx). */}
            <TableFrame toolbar={toolbar(false)}>
                <thead>
                    <tr>
                        {COLUMNAS.map((column) => (
                            <Th key={column}>{column}</Th>
                        ))}
                        <ActionsTh />
                    </tr>
                </thead>

                <tbody>
                    {productos === undefined ? (
                        <SkeletonRows columns={COLUMNAS.length} actions={3} />
                    ) : filteredProductos.length === 0 ? (
                        <EmptyRow colSpan={6}>No hay productos configurados todavía.</EmptyRow>
                    ) : (
                        filteredProductos.map((row) => (
                            <tr key={row.id} className={ROW_CLASS}>
                                <Td className="font-semibold">
                                    {row.titulo}
                                    {row.combo_items.length > 0 && (
                                        <span className="block text-xs font-normal text-secondary">{contenidoDeCombo(row)}</span>
                                    )}
                                </Td>
                                <Td>{accessTypeLabel[row.access_type]}</Td>
                                <Td className="whitespace-nowrap">{row.costo === null ? "--" : formatCOP(row.costo)}</Td>
                                <Td className="whitespace-nowrap">{row.precio_venta === null ? "--" : formatCOP(row.precio_venta)}</Td>
                                <Td className="font-medium whitespace-nowrap" style={{ color: gananciaColor(gananciaOf(row)) }}>
                                    {gananciaOf(row) === null ? "--" : formatCOP(gananciaOf(row)!)}
                                </Td>
                                <ActionsCell>
                                    <IconAction icon={Eye} label="Ver" onClick={() => setViewingId(row.id)} />
                                    <IconAction icon={Pencil} label="Editar" onClick={() => openEdit(row)} />
                                    <IconAction icon={Trash2} label="Eliminar" tone="danger" onClick={() => openDelete(row.id)} />
                                </ActionsCell>
                            </tr>
                        ))
                    )}
                </tbody>
            </TableFrame>

            <MobileFrame toolbar={toolbar(true)}>
                {productos === undefined ? (
                    <SkeletonCards labels={COLUMNAS} actions={3} />
                ) : filteredProductos.length === 0 ? (
                    <MobileEmpty>No hay productos configurados todavía.</MobileEmpty>
                ) : (
                    filteredProductos.map((row) => (
                        <MobileCard
                            key={row.id}
                            fields={[
                                { label: "Producto", value: row.titulo, className: "font-semibold" },
                                ...(row.combo_items.length > 0 ? [{ label: "Incluye", value: contenidoDeCombo(row) }] : []),
                                { label: "Tipo de acceso", value: accessTypeLabel[row.access_type] },
                                { label: "Costo (proveedor)", value: row.costo === null ? "--" : formatCOP(row.costo) },
                                { label: "Precio de venta", value: row.precio_venta === null ? "--" : formatCOP(row.precio_venta) },
                                {
                                    label: "Ganancia",
                                    value: gananciaOf(row) === null ? "--" : formatCOP(gananciaOf(row)!),
                                    className: "font-medium",
                                    style: { color: gananciaColor(gananciaOf(row)) },
                                },
                            ]}
                            actions={
                                <>
                                    <MobileAction icon={Eye} label="Ver" onClick={() => setViewingId(row.id)} />
                                    <MobileAction icon={Pencil} label="Editar" onClick={() => openEdit(row)} />
                                    <MobileAction icon={Trash2} label="Eliminar" tone="danger" onClick={() => openDelete(row.id)} />
                                </>
                            }
                        />
                    ))
                )}
            </MobileFrame>

            <Modal isOpen={createOpen} title="Agregar producto" onClose={closeCreate} dismissible={!isPending}>
                {/* Los dos caminos son distintos de raíz: el simple parte de una licencia ya comprada
                    (una plataforma), el combo se arma eligiendo varias del catálogo del proveedor. */}
                <div className="mb-4 inline-flex rounded-xl border border-white/10 bg-white/3 p-1">
                    {([["simple", "Producto simple"], ["combo", "Combo"]] as const).map(([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => {
                                setCreateTipo(value)
                                setModalError(null)
                            }}
                            disabled={isPending}
                            aria-pressed={createTipo === value}
                            className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed ${createTipo === value
                                ? "bg-accent/10 text-accent"
                                : "text-secondary hover:text-white"
                                }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {modalError && (
                    <div className="mb-3">
                        <Alert variant="error" message={modalError} />
                    </div>
                )}

                {createTipo === "simple" ? (
                    <Suspense fallback={<CreateProductoFormSkeleton onCancel={closeCreate} />}>
                        <CreateProductoForm
                            ofertaPromise={licenciasPromise}
                            isPending={isPending}
                            onPendingChange={setIsPending}
                            onSuccess={handleCreated}
                            onError={setModalError}
                            onCancel={closeCreate}
                        />
                    </Suspense>
                ) : (
                    <CreateComboForm
                        oferta={oferta}
                        isPending={isPending}
                        onPendingChange={setIsPending}
                        onSuccess={handleCreated}
                        onError={setModalError}
                        onCancel={closeCreate}
                    />
                )}
            </Modal>

            <Modal isOpen={viewingId !== null} title="Ver producto" onClose={() => setViewingId(null)}>
                {viewingRow && (
                    <div className="flex flex-col gap-3">
                        {[
                            ...camposDeProducto(viewingRow),
                            ["Precio de venta", viewingRow.precio_venta === null ? "--" : formatCOP(viewingRow.precio_venta)],
                            ["Ganancia", gananciaOf(viewingRow) === null ? "--" : formatCOP(gananciaOf(viewingRow)!)],
                        ].map(([label, value]) => (
                            <div key={label} className="flex flex-col gap-1">
                                <label className="text-xs text-secondary font-medium">{label}</label>
                                <CopyInput value={value} readOnly copyLabel="Copiar" successLabel="Copiado" />
                            </div>
                        ))}

                        <div className="flex items-center justify-end gap-2 mt-2">
                            <Button variant="ghost" onClick={() => setViewingId(null)}>Cerrar</Button>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal isOpen={editingId !== null} title="Editar producto" onClose={cancelEdit} dismissible={!isPending}>
                {editingRow && (
                    <div className="flex flex-col gap-3">
                        {modalError && <Alert variant="error" message={modalError} />}
                        {camposDeProducto(editingRow).map(([label, value]) => (
                            <div key={label} className="flex flex-col gap-1">
                                <label className="text-xs text-secondary font-medium">{label}</label>
                                {/* Solo el precio de venta se edita: el resto se ve apagado para que se note. */}
                                <Input value={value} disabled className="cursor-not-allowed opacity-50" />
                                {label === "Incluye" && (
                                    // La receta de un combo es su identidad: cambiarla es armar otro combo.
                                    <p className="text-xs text-secondary">Para cambiar el contenido, crea un combo nuevo y elimina este.</p>
                                )}
                            </div>
                        ))}
                        <div className="flex flex-col gap-1">
                            <label htmlFor="editar-producto-precio" className="text-xs text-secondary font-medium">Precio de venta</label>
                            <Input
                                id="editar-producto-precio"
                                className="bg-white/3"
                                type="text"
                                inputMode="numeric"
                                autoFocus
                                value={editPrecioVenta}
                                onChange={(e) => setEditPrecioVenta(e.target.value.replace(/\D/g, ""))}
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2 mt-2">
                            <Button variant="ghost" onClick={cancelEdit} disabled={isPending}>Cancelar</Button>
                            <Button variant="primary" onClick={saveEdit} isLoading={isPending}>
                                {isPending ? "Guardando..." : "Guardar"}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal isOpen={deletingId !== null} title="Eliminar producto" onClose={cancelDelete} dismissible={!isPending}>
                <div className="flex flex-col gap-3">
                    {modalError && <Alert variant="error" message={modalError} />}
                    <p className="text-sm text-white/90">
                        {deletingRow ? <>¿Eliminar <strong className="font-semibold text-white">{deletingRow.titulo}</strong>?</> : "¿Eliminar este producto?"} Dejará
                        de estar disponible para la venta.
                    </p>
                </div>
                <div className="flex items-center justify-end gap-2 mt-4">
                    <Button variant="ghost" onClick={cancelDelete} disabled={isPending}>Cancelar</Button>
                    <Button variant="danger" onClick={confirmDelete} isLoading={isPending}>
                        {isPending ? "Eliminando..." : "Eliminar"}
                    </Button>
                </div>
            </Modal>
        </div>
    )
}
