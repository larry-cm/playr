"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Card from "@ui/card"
import Button from "@ui/button"
import Input from "@ui/input"
import CopyInput from "@ui/copy-input"
import SelectDropdown from "@ui/select-dropdown"
import Modal from "@ui/modal"
import Alert from "@ui/alert"
import { AlertCircle, Eye, Pencil, Trash2 } from "lucide-react"
import { ActionsCell, EmptyRow, IconAction, MobileAction, MobileCard, MobileEmpty, MobileFrame, ROW_CLASS, SearchInput, TableFrame, Td, Th } from "@ui/data-frame"
import type { PerfilRow } from "@action/manager-and-admin/perfiles/get-all-perfiles-action"
import { editPerfilAction } from "@action/manager-and-admin/perfiles/edit-perfil-action"
import { deletePerfilAction } from "@action/manager-and-admin/perfiles/delete-perfil-action"
import { accessTypeLabel } from "@lib/access-type"
import { formatDateOnly } from "@lib/date"

const estadoLabel: Record<PerfilRow["estado"], string> = {
    disponible: "Disponible",
    vendido: "Vendido",
    suspendido: "Suspendido",
    en_soporte: "En soporte",
}

const estadoColor: Record<PerfilRow["estado"], string> = {
    disponible: "#34d399",
    vendido: "var(--color-accent)",
    suspendido: "#f87171",
    en_soporte: "#fbbf24",
}

const estadoOptions = (Object.keys(estadoLabel) as PerfilRow["estado"][]).map((value) => ({
    value,
    label: estadoLabel[value],
}))

interface PerfilesClientProps {
    initialPerfiles: PerfilRow[] | null
}

export default function PerfilesClient({ initialPerfiles }: PerfilesClientProps) {
    const router = useRouter()
    const [perfiles, setPerfiles] = useState<PerfilRow[] | null>(initialPerfiles)
    const [alert, setAlert] = useState<{ variant: "success" | "error"; message: string } | null>(null)
    const [isPending, setIsPending] = useState(false)

    const [editingId, setEditingId] = useState<number | null>(null)
    const [editEstado, setEditEstado] = useState<PerfilRow["estado"]>("disponible")

    const [viewingId, setViewingId] = useState<number | null>(null)
    const [deletingId, setDeletingId] = useState<number | null>(null)
    const [search, setSearch] = useState("")

    const filteredPerfiles = useMemo(() => {
        const query = search.trim().toLowerCase()
        if (!query) return perfiles ?? []
        return (perfiles ?? []).filter((row) =>
            [row.platform_nombre, row.cuenta_email, row.nombre_perfil, estadoLabel[row.estado]]
                .some((value) => value.toLowerCase().includes(query))
        )
    }, [perfiles, search])

    const editingRow = perfiles?.find((row) => row.id === editingId) ?? null
    const viewingRow = perfiles?.find((row) => row.id === viewingId) ?? null

    const openEdit = (row: PerfilRow) => {
        setEditingId(row.id)
        setEditEstado(row.estado)
    }

    const cancelEdit = () => setEditingId(null)

    const saveEdit = async () => {
        if (editingId === null || isPending) return
        const id = editingId

        setIsPending(true)
        setAlert(null)
        const error = await editPerfilAction({ id, estado: editEstado })
        setIsPending(false)

        if (error) {
            setAlert({ variant: "error", message: error })
            return
        }

        setPerfiles((prev) =>
            (prev ?? []).map((row) =>
                row.id === id
                    ? { ...row, estado: editEstado }
                    : row
            )
        )
        setAlert({ variant: "success", message: "Perfil actualizado correctamente." })
        setEditingId(null)
        // El estado decide si el perfil sigue en la Tienda: refrescar los server components.
        router.refresh()
    }

    const confirmDelete = async () => {
        if (deletingId === null || isPending) return
        setIsPending(true)
        setAlert(null)
        const error = await deletePerfilAction({ id: deletingId })
        setIsPending(false)

        if (error) {
            setAlert({ variant: "error", message: error })
            return
        }

        setPerfiles((prev) => (prev ?? []).filter((row) => row.id !== deletingId))
        setAlert({ variant: "success", message: "Perfil eliminado correctamente." })
        setDeletingId(null)
        router.refresh()
    }

    if (perfiles === null) {
        return (
            <Card padding="px-4 py-12" className="flex flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400 mb-4 shadow-lg shadow-red-500/5">
                    <AlertCircle className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">Error al cargar los perfiles</h3>
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

            {/* Marco, densidad y alto compartidos con el resto de tablas del panel (app/ui/data-frame.tsx). */}
            <TableFrame toolbar={<SearchInput value={search} onChange={setSearch} />}>
                <thead>
                    <tr>
                        {["Plataforma", "Perfil", "PIN", "Cuenta", "Estado", "Vencimiento"].map((column) => (
                            <Th key={column}>{column}</Th>
                        ))}
                        <Th align="right">Acciones</Th>
                    </tr>
                </thead>

                <tbody>
                    {filteredPerfiles.length === 0 ? (
                        <EmptyRow colSpan={7}>No hay perfiles comprados todavía.</EmptyRow>
                    ) : (
                        filteredPerfiles.map((row) => (
                            <tr key={row.id} className={ROW_CLASS}>
                                <Td className="font-semibold whitespace-nowrap">{row.platform_nombre}</Td>
                                <Td className="whitespace-nowrap">{row.nombre_perfil}</Td>
                                <Td className="whitespace-nowrap">{row.pin ?? "--"}</Td>
                                {/* El correo es lo más largo: parte línea para que la tabla no scrollee en x. */}
                                <Td className="break-all">{row.cuenta_email}</Td>
                                <Td className="font-medium whitespace-nowrap" style={{ color: estadoColor[row.estado] }}>
                                    {estadoLabel[row.estado]}
                                </Td>
                                <Td className="whitespace-nowrap">{formatDateOnly(row.fecha_vencimiento)}</Td>
                                <ActionsCell>
                                    <IconAction icon={Eye} label="Ver" onClick={() => setViewingId(row.id)} />
                                    <IconAction icon={Pencil} label="Editar" onClick={() => openEdit(row)} />
                                    <IconAction icon={Trash2} label="Eliminar" tone="danger" onClick={() => setDeletingId(row.id)} />
                                </ActionsCell>
                            </tr>
                        ))
                    )}
                </tbody>
            </TableFrame>

            <MobileFrame toolbar={<SearchInput value={search} onChange={setSearch} className="w-full" />}>
                {filteredPerfiles.length === 0 ? (
                    <MobileEmpty>No hay perfiles comprados todavía.</MobileEmpty>
                ) : (
                    filteredPerfiles.map((row) => (
                        <MobileCard
                            key={row.id}
                            fields={[
                                { label: "Plataforma", value: row.platform_nombre },
                                { label: "Perfil", value: row.nombre_perfil },
                                { label: "PIN", value: row.pin ?? "--" },
                                { label: "Cuenta", value: row.cuenta_email, className: "break-all" },
                                { label: "Estado", value: estadoLabel[row.estado], className: "font-medium", style: { color: estadoColor[row.estado] } },
                                { label: "Vencimiento", value: formatDateOnly(row.fecha_vencimiento) },
                            ]}
                            actions={
                                <>
                                    <MobileAction icon={Eye} label="Ver" onClick={() => setViewingId(row.id)} />
                                    <MobileAction icon={Pencil} label="Editar" onClick={() => openEdit(row)} />
                                    <MobileAction icon={Trash2} label="Eliminar" tone="danger" onClick={() => setDeletingId(row.id)} />
                                </>
                            }
                        />
                    ))
                )}
            </MobileFrame>

            <Modal isOpen={viewingId !== null} title="Ver perfil" onClose={() => setViewingId(null)}>
                {viewingRow && (
                    <div className="flex flex-col gap-3">
                        {[
                            ["Plataforma", `${viewingRow.platform_nombre} · ${accessTypeLabel[viewingRow.access_type]}`],
                            ["Perfil", viewingRow.nombre_perfil],
                            ["PIN", viewingRow.pin ?? ""],
                            ["Cuenta", viewingRow.cuenta_email],
                            ["Estado", estadoLabel[viewingRow.estado]],
                            ["Vencimiento", formatDateOnly(viewingRow.fecha_vencimiento)],
                        ].map(([label, value]) => (
                            <div key={label} className="flex flex-col gap-1">
                                <label className="text-xs text-secondary font-medium">{label}</label>
                                <CopyInput className="bg-white/3" value={value} placeholder="--" readOnly copyLabel="Copiar" successLabel="Copiado" />
                            </div>
                        ))}
                    </div>
                )}
            </Modal>

            <Modal isOpen={editingId !== null} title="Editar perfil" onClose={cancelEdit}>
                {editingRow && (
                    <div className="flex flex-col gap-3">
                        {/* Solo el estado se edita: el resto viene del proveedor y se muestra deshabilitado. */}
                        {[
                            ["Plataforma", `${editingRow.platform_nombre} · ${accessTypeLabel[editingRow.access_type]}`],
                            ["Cuenta", editingRow.cuenta_email],
                            ["Nombre del perfil", editingRow.nombre_perfil],
                            ["PIN", editingRow.pin ?? ""],
                        ].map(([label, value]) => (
                            <div key={label} className="flex flex-col gap-1">
                                <label className="text-xs text-secondary font-medium">{label}</label>
                                <Input className="bg-white/3 cursor-not-allowed opacity-60" value={value} placeholder="--" disabled />
                            </div>
                        ))}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-secondary font-medium">Estado</label>
                            <SelectDropdown
                                value={editEstado}
                                onChange={(value) => setEditEstado(value as PerfilRow["estado"])}
                                options={estadoOptions}
                            />
                            <p className="text-xs text-secondary">Solo los perfiles disponibles se muestran en la Tienda.</p>
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
                <div className="text-sm text-white/90">¿Eliminar este perfil? Dejará de estar disponible para la venta.</div>
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
