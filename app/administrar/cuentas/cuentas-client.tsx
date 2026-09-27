"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Card from "@ui/card"
import Button from "@ui/button"
import Input from "@ui/input"
import Modal from "@ui/modal"
import Alert from "@ui/alert"
import Link from "next/link"
import { AlertCircle, ArrowUpRight, Eye, Pencil, RefreshCw, Trash2 } from "lucide-react"
import { ActionsCell, ActionsTh, EmptyRow, IconAction, MobileAction, MobileCard, MobileEmpty, MobileFrame, ROW_CLASS, SearchInput, SkeletonCards, SkeletonRows, TableFrame, Td, Th } from "@ui/data-frame"
import type { CuentaRow } from "@action/manager-and-admin/cuentas/get-all-cuentas-action"
import { editCuentaAction } from "@action/manager-and-admin/cuentas/edit-cuenta-action"
import { deleteCuentaAction } from "@action/manager-and-admin/cuentas/delete-cuenta-action"
import { accessTypeLabel } from "@lib/access-type"
import { formatDateOnly } from "@lib/date"
import { capitalizar } from "@lib/text"
import { formatCOP } from "@lib/currency"
import FiltrosSelect, { pasaFiltro, sinFiltro, type Filtro } from "@ui/filtros-select"
import { CAMPOS_CUENTAS } from "@/app/administrar/cuentas/filtros-cuentas"
import VerCuentaModal from "@/app/administrar/cuentas/ver-cuenta-modal"

/** Una cuenta llena cuando ya no le quedan perfiles libres: es la señal de "hay que reponer". */
const ocupacionColor = (row: CuentaRow) =>
    row.perfiles_disponibles === 0 ? '#f87171' : '#34d399'

/** "2 de 5" enlazado a Perfiles filtrado por esta cuenta: solo una flecha tenue lo delata, y se aviva al pasar el mouse. */
function PerfilesLink({ row }: Readonly<{ row: CuentaRow }>) {
    return (
        <Link
            href={`/administrar/perfiles?cuenta=${row.id}`}
            title="Ver los perfiles de esta cuenta"
            aria-label={`Ver los perfiles de ${row.email}`}
            className="group inline-flex items-center gap-1 font-medium underline decoration-transparent decoration-dotted underline-offset-4 transition hover:decoration-current"
            style={{ color: ocupacionColor(row) }}
        >
            {row.perfiles_disponibles} de {row.perfiles_total}
            <ArrowUpRight className="h-3.5 w-3.5 opacity-40 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
        </Link>
    )
}

const COLUMNAS = ["Plataforma", "Correo", "Perfiles libres", "Vencimiento"]

interface CuentasClientProps {
    /** undefined = la página aún carga (loading.tsx) · null = error */
    initialCuentas: CuentaRow[] | null | undefined
}

export default function CuentasClient({ initialCuentas }: CuentasClientProps) {
    const router = useRouter()
    const [cuentas, setCuentas] = useState<CuentaRow[] | null | undefined>(initialCuentas)
    // Cuando el servidor manda datos nuevos (Reintentar, o el revalidatePath de una acción) mandan esos.
    const [prevInitial, setPrevInitial] = useState(initialCuentas)
    if (initialCuentas !== prevInitial) {
        setPrevInitial(initialCuentas)
        setCuentas(initialCuentas)
    }
    const [alert, setAlert] = useState<{ variant: "success" | "error"; message: string } | null>(null)
    /** Error de la operación del modal abierto: se muestra dentro del modal, no detrás del fondo. */
    const [modalError, setModalError] = useState<string | null>(null)
    const [isPending, setIsPending] = useState(false)
    const [reintentando, startReintento] = useTransition()

    const [editingId, setEditingId] = useState<number | null>(null)
    const [editEmail, setEditEmail] = useState("")

    const [viewingId, setViewingId] = useState<number | null>(null)
    const [deletingId, setDeletingId] = useState<number | null>(null)
    const [search, setSearch] = useState("")
    const [filtro, setFiltro] = useState<Filtro>(() => sinFiltro(CAMPOS_CUENTAS))

    const filteredCuentas = useMemo(() => {
        const query = search.trim().toLowerCase()
        const filtradas = (cuentas ?? []).filter((row) => pasaFiltro(row, CAMPOS_CUENTAS, filtro))
        if (!query) return filtradas
        return filtradas.filter((row) =>
            [row.platform_nombre, row.email, accessTypeLabel[row.access_type]]
                .some((value) => value.toLowerCase().includes(query))
        )
    }, [cuentas, search, filtro])

    const toolbar = (mobile: boolean) => (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <SearchInput value={search} onChange={setSearch} className={mobile ? "w-full" : "w-full lg:w-72"} />
            <FiltrosSelect campos={CAMPOS_CUENTAS} items={cuentas ?? []} value={filtro} onChange={setFiltro} mobile={mobile} />
        </div>
    )

    const editingRow = cuentas?.find((row) => row.id === editingId) ?? null
    const viewingRow = cuentas?.find((row) => row.id === viewingId) ?? null
    const deletingRow = cuentas?.find((row) => row.id === deletingId) ?? null

    const openEdit = (row: CuentaRow) => {
        setModalError(null)
        setEditingId(row.id)
        setEditEmail(row.email)
    }

    const cancelEdit = () => {
        setEditingId(null)
        setModalError(null)
    }

    const openDelete = (id: number) => {
        setModalError(null)
        setDeletingId(id)
    }

    const cancelDelete = () => {
        setDeletingId(null)
        setModalError(null)
    }

    // Editar y eliminar actualizan la tabla en local, sin router.refresh(): las acciones ya revalidan Perfiles, Tienda y
    // el panel (revalidatePath), así que esas páginas salen frescas al visitarlas.
    const saveEdit = async () => {
        if (editingId === null || isPending) return
        const id = editingId

        setIsPending(true)
        setModalError(null)
        setAlert(null)
        const error = await editCuentaAction({ id, email: editEmail }).catch(() => "No se pudo guardar la cuenta. Inténtalo de nuevo.")
        setIsPending(false)

        if (error) {
            setModalError(error)
            return
        }

        setCuentas((prev) =>
            (prev ?? []).map((row) =>
                row.id === id
                    ? { ...row, email: editEmail.trim().toLowerCase() }
                    : row
            )
        )
        setAlert({ variant: "success", message: "Cuenta actualizada correctamente." })
        setEditingId(null)
    }

    const confirmDelete = async () => {
        if (deletingId === null || isPending) return
        const id = deletingId
        setIsPending(true)
        setModalError(null)
        setAlert(null)
        const error = await deleteCuentaAction({ id }).catch(() => "No se pudo eliminar la cuenta. Inténtalo de nuevo.")
        setIsPending(false)

        if (error) {
            setModalError(error)
            return
        }

        // Se fueron también sus perfiles: Perfiles y los contadores del panel los revalida la acción.
        setCuentas((prev) => (prev ?? []).filter((row) => row.id !== id))
        setAlert({ variant: "success", message: "Cuenta eliminada correctamente." })
        setDeletingId(null)
    }

    if (cuentas === null) {
        return (
            <Card padding="px-4 py-12" className="flex flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400 mb-4 shadow-lg shadow-red-500/5">
                    <AlertCircle className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">Error al cargar las cuentas</h3>
                <p className="text-sm text-white/60 max-w-md">
                    Tuvimos un problema al obtener la información. Verifica la conexión e inténtalo de nuevo.
                </p>
                <Button variant="secondary" className="mt-4" isLoading={reintentando} onClick={() => startReintento(() => router.refresh())} leftIcon={<RefreshCw className="h-4 w-4" />}>
                    Reintentar
                </Button>
            </Card>
        )
    }

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
                    {cuentas === undefined ? (
                        <SkeletonRows columns={COLUMNAS.length} actions={3} />
                    ) : filteredCuentas.length === 0 ? (
                        <EmptyRow colSpan={5}>{cuentas?.length ? "Ninguna cuenta coincide con la búsqueda o los filtros." : "No hay cuentas compradas todavía."}</EmptyRow>
                    ) : (
                        filteredCuentas.map((row) => (
                            <tr key={row.id} className={ROW_CLASS}>
                                <Td className="font-semibold">{capitalizar(row.platform_nombre)}</Td>
                                <Td className="break-all">{row.email}</Td>
                                <Td className="whitespace-nowrap">
                                    <PerfilesLink row={row} />
                                </Td>
                                <Td className="whitespace-nowrap">{formatDateOnly(row.fecha_vencimiento)}</Td>
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
                {cuentas === undefined ? (
                    <SkeletonCards labels={COLUMNAS} actions={3} />
                ) : filteredCuentas.length === 0 ? (
                    <MobileEmpty>{cuentas?.length ? "Ninguna cuenta coincide con la búsqueda o los filtros." : "No hay cuentas compradas todavía."}</MobileEmpty>
                ) : (
                    filteredCuentas.map((row) => (
                        <MobileCard
                            key={row.id}
                            fields={[
                                { label: "Plataforma", value: capitalizar(row.platform_nombre) },
                                { label: "Correo", value: row.email, className: "break-all" },
                                { label: "Perfiles libres", value: <PerfilesLink row={row} /> },
                                { label: "Vencimiento", value: formatDateOnly(row.fecha_vencimiento) },
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

            {viewingRow && <VerCuentaModal key={viewingRow.id} cuenta={viewingRow} onClose={() => setViewingId(null)} />}

            <Modal isOpen={editingId !== null} title="Editar cuenta" onClose={cancelEdit} dismissible={!isPending}>
                {editingRow && (
                    <div className="flex flex-col gap-3">
                        {modalError && <Alert variant="error" message={modalError} />}
                        {/* Solo el correo se edita: el resto viene de la compra y se muestra deshabilitado. */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-secondary font-medium">Plataforma</label>
                            <Input className="bg-white/3 cursor-not-allowed opacity-60" value={`${capitalizar(editingRow.platform_nombre)} · ${accessTypeLabel[editingRow.access_type]}`} disabled />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label htmlFor="editar-cuenta-correo" className="text-xs text-secondary font-medium">Correo</label>
                            <Input
                                id="editar-cuenta-correo"
                                className="bg-white/3"
                                type="email"
                                autoComplete="off"
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                autoFocus
                                message="Debe coincidir con el del proveedor: con él se consulta la contraseña."
                            />
                        </div>
                        {[
                            ["Vencimiento", formatDateOnly(editingRow.fecha_vencimiento)],
                            ["Costo (proveedor)", editingRow.costo === null ? "--" : formatCOP(editingRow.costo)],
                        ].map(([label, value]) => (
                            <div key={label} className="flex flex-col gap-1">
                                <label className="text-xs text-secondary font-medium">{label}</label>
                                <Input className="bg-white/3 cursor-not-allowed opacity-60" value={value} disabled />
                            </div>
                        ))}
                        <div className="flex items-center justify-end gap-2 mt-2">
                            <Button variant="ghost" onClick={cancelEdit} disabled={isPending}>Cancelar</Button>
                            <Button variant="primary" onClick={saveEdit} isLoading={isPending}>
                                {isPending ? "Guardando..." : "Guardar"}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal isOpen={deletingId !== null} title="Eliminar cuenta" onClose={cancelDelete} dismissible={!isPending}>
                <div className="flex flex-col gap-3">
                    {modalError && <Alert variant="error" message={modalError} />}
                    <p className="text-sm text-white/90">
                        ¿Eliminar{" "}
                        {deletingRow ? (
                            <>la cuenta <strong className="font-semibold text-white">{capitalizar(deletingRow.platform_nombre)} · {deletingRow.email}</strong>?</>
                        ) : "esta cuenta?"}{" "}
                        {deletingRow && deletingRow.perfiles_total > 0
                            ? `También se eliminarán sus ${deletingRow.perfiles_total} perfil(es) y dejarán de estar a la venta.`
                            : "Dejará de estar disponible para la venta."}
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
