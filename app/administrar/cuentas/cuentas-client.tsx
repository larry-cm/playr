"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Card from "@ui/card"
import Button from "@ui/button"
import Input from "@ui/input"
import CopyInput from "@ui/copy-input"
import Modal from "@ui/modal"
import Alert from "@ui/alert"
import { AlertCircle, Pencil, Trash2 } from "lucide-react"
import { ActionsCell, ActionsTh, EmptyRow, IconAction, MobileAction, MobileCard, MobileEmpty, MobileFrame, ROW_CLASS, SearchInput, TableFrame, Td, Th } from "@ui/data-frame"
import type { CuentaRow } from "@action/manager-and-admin/cuentas/get-all-cuentas-action"
import { editCuentaAction } from "@action/manager-and-admin/cuentas/edit-cuenta-action"
import { deleteCuentaAction } from "@action/manager-and-admin/cuentas/delete-cuenta-action"
import { accessTypeLabel } from "@lib/access-type"
import { formatCOP } from "@lib/currency"
import { formatDateOnly } from "@lib/date"

/** Una cuenta llena cuando ya no le quedan perfiles libres: es la señal de "hay que reponer". */
const ocupacionColor = (row: CuentaRow) =>
    row.perfiles_disponibles === 0 ? '#f87171' : '#34d399'

interface CuentasClientProps {
    initialCuentas: CuentaRow[] | null
}

export default function CuentasClient({ initialCuentas }: CuentasClientProps) {
    const router = useRouter()
    const [cuentas, setCuentas] = useState<CuentaRow[] | null>(initialCuentas)
    const [alert, setAlert] = useState<{ variant: "success" | "error"; message: string } | null>(null)
    const [isPending, setIsPending] = useState(false)

    const [editingId, setEditingId] = useState<number | null>(null)
    const [editFechaVencimiento, setEditFechaVencimiento] = useState("")
    const [editCosto, setEditCosto] = useState("")
    const [editPerfilMax, setEditPerfilMax] = useState("")

    const [deletingId, setDeletingId] = useState<number | null>(null)
    const [search, setSearch] = useState("")

    const filteredCuentas = useMemo(() => {
        const query = search.trim().toLowerCase()
        if (!query) return cuentas ?? []
        return (cuentas ?? []).filter((row) =>
            [row.platform_nombre, row.email, accessTypeLabel[row.access_type]]
                .some((value) => value.toLowerCase().includes(query))
        )
    }, [cuentas, search])

    const editingRow = cuentas?.find((row) => row.id === editingId) ?? null
    const deletingRow = cuentas?.find((row) => row.id === deletingId) ?? null

    const openEdit = (row: CuentaRow) => {
        setEditingId(row.id)
        setEditFechaVencimiento(row.fecha_vencimiento ?? "")
        setEditCosto(row.costo === null ? "" : String(row.costo))
        setEditPerfilMax(String(row.perfil_max))
    }

    const cancelEdit = () => setEditingId(null)

    const saveEdit = async () => {
        if (editingId === null || isPending) return
        const id = editingId

        setIsPending(true)
        setAlert(null)
        const error = await editCuentaAction({
            id,
            fecha_vencimiento: editFechaVencimiento,
            costo: editCosto,
            perfil_max: editPerfilMax,
        })
        setIsPending(false)

        if (error) {
            setAlert({ variant: "error", message: error })
            return
        }

        setCuentas((prev) =>
            (prev ?? []).map((row) =>
                row.id === id
                    ? {
                        ...row,
                        fecha_vencimiento: editFechaVencimiento === "" ? null : editFechaVencimiento,
                        costo: editCosto === "" ? null : Number(editCosto),
                        perfil_max: Number(editPerfilMax),
                    }
                    : row
            )
        )
        setAlert({ variant: "success", message: "Cuenta actualizada correctamente." })
        setEditingId(null)
        router.refresh()
    }

    const confirmDelete = async () => {
        if (deletingId === null || isPending) return
        setIsPending(true)
        setAlert(null)
        const error = await deleteCuentaAction({ id: deletingId })
        setIsPending(false)

        if (error) {
            setAlert({ variant: "error", message: error })
            return
        }

        setCuentas((prev) => (prev ?? []).filter((row) => row.id !== deletingId))
        setAlert({ variant: "success", message: "Cuenta eliminada correctamente." })
        setDeletingId(null)
        // Se fueron también sus perfiles: /administrar/perfiles y los contadores del panel cambian.
        router.refresh()
    }

    if (cuentas === null) {
        return (
            <Card padding="px-4 py-12" className="flex flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400 mb-4 shadow-lg shadow-red-500/5">
                    <AlertCircle className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">Error al cargar las cuentas</h3>
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
                        {["Plataforma", "Tipo de acceso", "Correo", "Perfiles libres", "Vencimiento", "Costo"].map((column) => (
                            <Th key={column}>{column}</Th>
                        ))}
                        <ActionsTh />
                    </tr>
                </thead>

                <tbody>
                    {filteredCuentas.length === 0 ? (
                        <EmptyRow colSpan={7}>No hay cuentas compradas todavía.</EmptyRow>
                    ) : (
                        filteredCuentas.map((row) => (
                            <tr key={row.id} className={ROW_CLASS}>
                                <Td className="font-semibold">{row.platform_nombre}</Td>
                                <Td>{accessTypeLabel[row.access_type]}</Td>
                                <Td className="break-all">{row.email}</Td>
                                <Td className="font-medium whitespace-nowrap" style={{ color: ocupacionColor(row) }}>
                                    {row.perfiles_disponibles} de {row.perfiles_total}
                                </Td>
                                <Td className="whitespace-nowrap">{formatDateOnly(row.fecha_vencimiento)}</Td>
                                <Td className="whitespace-nowrap">{row.costo === null ? "--" : formatCOP(row.costo)}</Td>
                                <ActionsCell>
                                    <IconAction icon={Pencil} label="Editar" onClick={() => openEdit(row)} />
                                    <IconAction icon={Trash2} label="Eliminar" tone="danger" onClick={() => setDeletingId(row.id)} />
                                </ActionsCell>
                            </tr>
                        ))
                    )}
                </tbody>
            </TableFrame>

            <MobileFrame toolbar={<SearchInput value={search} onChange={setSearch} className="w-full" />}>
                {filteredCuentas.length === 0 ? (
                    <MobileEmpty>No hay cuentas compradas todavía.</MobileEmpty>
                ) : (
                    filteredCuentas.map((row) => (
                        <MobileCard
                            key={row.id}
                            fields={[
                                { label: "Plataforma", value: row.platform_nombre },
                                { label: "Tipo de acceso", value: accessTypeLabel[row.access_type] },
                                { label: "Correo", value: row.email, className: "break-all" },
                                { label: "Perfiles libres", value: `${row.perfiles_disponibles} de ${row.perfiles_total}`, className: "font-medium", style: { color: ocupacionColor(row) } },
                                { label: "Vencimiento", value: formatDateOnly(row.fecha_vencimiento) },
                                { label: "Costo", value: row.costo === null ? "--" : formatCOP(row.costo) },
                            ]}
                            actions={
                                <>
                                    <MobileAction icon={Pencil} label="Editar" onClick={() => openEdit(row)} />
                                    <MobileAction icon={Trash2} label="Eliminar" tone="danger" onClick={() => setDeletingId(row.id)} />
                                </>
                            }
                        />
                    ))
                )}
            </MobileFrame>

            <Modal isOpen={editingId !== null} title="Editar cuenta" onClose={cancelEdit}>
                {editingRow && (
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-secondary font-medium">Plataforma</label>
                            <CopyInput value={editingRow.platform_nombre} readOnly copyLabel="Copiar" successLabel="Copiado" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-secondary font-medium">Tipo de acceso</label>
                            <CopyInput value={accessTypeLabel[editingRow.access_type]} readOnly copyLabel="Copiar" successLabel="Copiado" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-secondary font-medium">Correo</label>
                            <CopyInput value={editingRow.email} readOnly copyLabel="Copiar" successLabel="Copiado" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-secondary font-medium">Perfiles cargados</label>
                            <Input
                                className="bg-white/3"
                                value={`${editingRow.perfiles_total} (${editingRow.perfiles_disponibles} disponibles)`}
                                readOnly
                            />
                            <p className="text-xs text-secondary">Se gestionan uno por uno en Perfiles.</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-secondary font-medium">Perfiles que admite</label>
                            <Input
                                className="bg-white/3"
                                type="number"
                                min="1"
                                max="10"
                                value={editPerfilMax}
                                onChange={(e) => setEditPerfilMax(e.target.value)}
                            />
                            <p className="text-xs text-secondary">Cuántas pantallas soporta este login en la plataforma.</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-secondary font-medium">Vencimiento</label>
                            <Input
                                className="bg-white/3"
                                type="date"
                                value={editFechaVencimiento}
                                onChange={(e) => setEditFechaVencimiento(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-secondary font-medium">Costo (proveedor)</label>
                            <Input
                                className="bg-white/3"
                                type="number"
                                min="0"
                                value={editCosto}
                                onChange={(e) => setEditCosto(e.target.value)}
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
                <div className="text-sm text-white/90">
                    {deletingRow && deletingRow.perfiles_total > 0
                        ? `¿Eliminar esta cuenta? También se eliminarán sus ${deletingRow.perfiles_total} perfil(es) y dejarán de estar a la venta.`
                        : "¿Eliminar esta cuenta? Dejará de estar disponible para la venta."}
                </div>
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
