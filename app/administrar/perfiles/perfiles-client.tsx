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
import { AlertCircle, Pencil, Trash2, Search } from "lucide-react"
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
    const [editNombre, setEditNombre] = useState("")
    const [editPin, setEditPin] = useState("")
    const [editEstado, setEditEstado] = useState<PerfilRow["estado"]>("disponible")

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

    const openEdit = (row: PerfilRow) => {
        setEditingId(row.id)
        setEditNombre(row.nombre_perfil)
        setEditPin(row.pin ?? "")
        setEditEstado(row.estado)
    }

    const cancelEdit = () => setEditingId(null)

    const saveEdit = async () => {
        if (editingId === null || isPending) return
        const id = editingId

        setIsPending(true)
        setAlert(null)
        const error = await editPerfilAction({
            id,
            nombre_perfil: editNombre,
            pin: editPin,
            estado: editEstado,
        })
        setIsPending(false)

        if (error) {
            setAlert({ variant: "error", message: error })
            return
        }

        setPerfiles((prev) =>
            (prev ?? []).map((row) =>
                row.id === id
                    ? { ...row, nombre_perfil: editNombre.trim(), pin: editPin.trim() === "" ? null : editPin.trim(), estado: editEstado }
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
            <Card className="flex flex-col items-center justify-center py-12 px-4 text-center">
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
                                        {["Plataforma", "Perfil", "PIN", "Cuenta", "Estado", "Vencimiento"].map((column) => (
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
                                    {filteredPerfiles.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--color-secondary)' }}>
                                                No hay perfiles comprados todavía.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredPerfiles.map((row) => (
                                            <tr key={row.id} className="group transition-colors hover:bg-white/3">
                                                <td className="px-4 py-4 align-middle font-semibold" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{row.platform_nombre}</td>
                                                <td className="px-4 py-4 align-middle" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{row.nombre_perfil}</td>
                                                <td className="px-4 py-4 align-middle" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{row.pin ?? "--"}</td>
                                                <td className="px-4 py-4 align-middle" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{row.cuenta_email}</td>
                                                <td className="px-4 py-4 align-middle font-medium" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: estadoColor[row.estado] }}>
                                                    {estadoLabel[row.estado]}
                                                </td>
                                                <td className="px-4 py-4 align-middle" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                    {formatDateOnly(row.fecha_vencimiento)}
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
                    {filteredPerfiles.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--color-secondary)' }}>No hay perfiles comprados todavía.</div>
                    ) : (
                        filteredPerfiles.map((row) => (
                            <div key={row.id} className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 6px 16px rgba(2,6,23,0.25)' }}>
                                <div className="p-4">
                                    {[
                                        ["Plataforma", row.platform_nombre],
                                        ["Perfil", row.nombre_perfil],
                                        ["PIN", row.pin ?? "--"],
                                        ["Cuenta", row.cuenta_email],
                                        ["Vencimiento", formatDateOnly(row.fecha_vencimiento)],
                                    ].map(([label, value]) => (
                                        <div key={label} className="flex items-start justify-between gap-3 py-2">
                                            <div className="text-xs font-medium" style={{ color: 'var(--color-secondary)' }}>{label}</div>
                                            <div className="text-sm" style={{ color: 'var(--color-foreground)' }}>{value}</div>
                                        </div>
                                    ))}
                                    <div className="flex items-start justify-between gap-3 py-2">
                                        <div className="text-xs font-medium" style={{ color: 'var(--color-secondary)' }}>Estado</div>
                                        <div className="text-sm font-medium" style={{ color: estadoColor[row.estado] }}>
                                            {estadoLabel[row.estado]}
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

            <Modal isOpen={editingId !== null} title="Editar perfil" onClose={cancelEdit}>
                {editingRow && (
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-secondary font-medium">Plataforma</label>
                            <CopyInput value={`${editingRow.platform_nombre} · ${accessTypeLabel[editingRow.access_type]}`} readOnly copyLabel="Copiar" successLabel="Copiado" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-secondary font-medium">Cuenta</label>
                            <CopyInput value={editingRow.cuenta_email} readOnly copyLabel="Copiar" successLabel="Copiado" />
                            <p className="text-xs text-secondary">El vencimiento y el costo se editan en Cuentas.</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-secondary font-medium">
                                Nombre del perfil<span className="text-accent ml-0.5">*</span>
                            </label>
                            <Input
                                className="bg-white/3"
                                value={editNombre}
                                onChange={(e) => setEditNombre(e.target.value)}
                                required
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-secondary font-medium">PIN</label>
                            <Input
                                className="bg-white/3"
                                value={editPin}
                                onChange={(e) => setEditPin(e.target.value)}
                            />
                        </div>
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
