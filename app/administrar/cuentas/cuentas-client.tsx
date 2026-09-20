"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Card from "@ui/card"
import Button from "@ui/button"
import Input from "@ui/input"
import CopyInput from "@ui/copy-input"
import Modal from "@ui/modal"
import Alert from "@ui/alert"
import { AlertCircle, Pencil, Trash2, Search } from "lucide-react"
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
            <Card className="flex flex-col items-center justify-center py-12 px-4 text-center">
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
                        </div>

                        <div className="h-[480px] overflow-y-auto">
                            <table className="w-full border-collapse text-left text-sm" style={{ color: 'var(--color-foreground)' }}>
                                <thead>
                                    <tr>
                                        {["Plataforma", "Tipo de acceso", "Correo", "Perfiles libres", "Vencimiento", "Costo"].map((column) => (
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
                                    {filteredCuentas.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--color-secondary)' }}>
                                                No hay cuentas compradas todavía.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredCuentas.map((row) => (
                                            <tr key={row.id} className="group transition-colors hover:bg-white/3">
                                                <td className="px-4 py-4 align-middle font-semibold" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{row.platform_nombre}</td>
                                                <td className="px-4 py-4 align-middle" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{accessTypeLabel[row.access_type]}</td>
                                                <td className="px-4 py-4 align-middle" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{row.email}</td>
                                                <td className="px-4 py-4 align-middle font-medium" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: ocupacionColor(row) }}>
                                                    {row.perfiles_disponibles} de {row.perfiles_total}
                                                </td>
                                                <td className="px-4 py-4 align-middle" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                    {formatDateOnly(row.fecha_vencimiento)}
                                                </td>
                                                <td className="px-4 py-4 align-middle" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                    {row.costo === null ? "--" : formatCOP(row.costo)}
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
                </div>

                <div className="h-[480px] overflow-y-auto flex flex-col gap-3">
                    {filteredCuentas.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--color-secondary)' }}>No hay cuentas compradas todavía.</div>
                    ) : (
                        filteredCuentas.map((row) => (
                            <div key={row.id} className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 6px 16px rgba(2,6,23,0.25)' }}>
                                <div className="p-4">
                                    {[
                                        ["Plataforma", row.platform_nombre],
                                        ["Tipo de acceso", accessTypeLabel[row.access_type]],
                                        ["Correo", row.email],
                                        ["Vencimiento", formatDateOnly(row.fecha_vencimiento)],
                                        ["Costo", row.costo === null ? "--" : formatCOP(row.costo)],
                                    ].map(([label, value]) => (
                                        <div key={label} className="flex items-start justify-between gap-3 py-2">
                                            <div className="text-xs font-medium" style={{ color: 'var(--color-secondary)' }}>{label}</div>
                                            <div className="text-sm" style={{ color: 'var(--color-foreground)' }}>{value}</div>
                                        </div>
                                    ))}
                                    <div className="flex items-start justify-between gap-3 py-2">
                                        <div className="text-xs font-medium" style={{ color: 'var(--color-secondary)' }}>Perfiles libres</div>
                                        <div className="text-sm font-medium" style={{ color: ocupacionColor(row) }}>
                                            {row.perfiles_disponibles} de {row.perfiles_total}
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
