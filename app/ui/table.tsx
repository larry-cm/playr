"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Button from "@ui/button"
import Input from "@ui/input"
import type { ValidationState } from "@ui/input"
import Modal from "@ui/modal"
import CopyInput from "@ui/copy-input"
import PhoneInput from "@ui/phone-input"
import Alert from "@ui/alert"
import { Eye, Edit, Trash2, Search, Plus } from "lucide-react"
import { validateEmail, validatePassword, validateUsername, validatePhoneValue } from "@lib/validation"
import { splitPhoneNumber } from "@lib/phone"

/** Resultado que devuelve cada operación contra el servidor. */
export interface MutationResult<T = Record<string, unknown>> {
    ok: boolean;
    error?: string;
    row?: T;
}

interface TableProps<T extends Record<string, unknown>> {
    header: string[];
    data: T[];
    className?: string;
    showActions?: boolean;
    /** Columnas que se muestran pero no se pueden editar ni escribir al crear. */
    readOnlyColumns?: string[];
    onEditSave?: (row: T, id: string | number) => Promise<MutationResult<T>> | MutationResult<T>;
    onDelete?: (id: string, index: number) => Promise<MutationResult<T>> | MutationResult<T>;
    onCreateSave?: (row: Record<string, unknown>) => Promise<MutationResult<T>> | MutationResult<T>;
}

/** El modal infiere el tipo de campo por el nombre de la columna. */
const isPhoneColumn = (column: string) => /\b(tel[eé]fono|celular|phone|m[oó]vil)\b/i.test(column)

const formatCellValue = (value: unknown) => {
    if (value === null || value === undefined) {
        return "--"
    }

    if (typeof value === "boolean") {
        return value ? "Sí" : "No"
    }

    if (Array.isArray(value)) {
        return value.join(", ")
    }

    if (typeof value === "object") {
        try {
            return JSON.stringify(value)
        } catch {
            return String(value)
        }
    }

    return String(value)
}

export default function Table<T extends Record<string, unknown>>({
    header,
    data,
    className = "",
    showActions = true,
    readOnlyColumns = [],
    onEditSave,
    onDelete,
    onCreateSave,
}: Readonly<TableProps<T>>) {
    const [rows, setRows] = useState<T[]>(data)
    const [alert, setAlert] = useState<{ variant: "success" | "error"; message: string } | null>(null)
    const [isPending, setIsPending] = useState(false)
    const [viewRow, setViewRow] = useState<T | null>(null)
    const [viewCreate, setViewCreate] = useState<boolean>(false)
    const [createRow, setCreateRow] = useState<Record<string, any> | null>(null)
    const [editRowId, setEditRowId] = useState<string | number | null>(null)
    const [editedRow, setEditedRow] = useState<Record<string, any> | null>(null)
    const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})
    // El indicativo y el número se editan por separado. Si se recalcularan desde el
    // texto guardado en cada tecla, un valor a medias como "+57 3" volvería a leerse
    // como el número "573" y el indicativo se iría acumulando.
    const [phoneDrafts, setPhoneDrafts] = useState<Record<string, { code: string; number: string }>>({})
    const phoneDraftsRef = useRef<Record<string, { code: string; number: string }>>({})
    const [isConfirmId, setIsConfirmId] = useState<string | null>(null)
    const [search, setSearch] = useState("")

    useEffect(() => {
        setRows(data)
    }, [data])

    const getRowId = (row: T, index: number): string => {
        return (row as any)?.Id ?? (row as any)?.id ?? index
    }

    // Siembra los borradores de teléfono al abrir un modal y los limpia al cerrarlo.
    const resetPhoneDrafts = (row?: Record<string, unknown> | null) => {
        const drafts: Record<string, { code: string; number: string }> = {}
        for (const column of header) {
            if (isPhoneColumn(column)) drafts[column] = splitPhoneNumber(String(row?.[column] ?? ""))
        }
        phoneDraftsRef.current = drafts
        setPhoneDrafts(drafts)
    }

    const openView = (row: T) => {
        setViewRow(row)
        setEditedRow({ ...row })
    }

    const openCreate = () => {
        setCreateRow({})
        setTouchedFields({})
        resetPhoneDrafts(null)
        setViewCreate(true)
    }

    // Ejecuta la operación contra el servidor y normaliza cualquier excepción.
    const runMutation = async (
        action: () => Promise<MutationResult<T>> | MutationResult<T>,
        fallbackError: string,
    ): Promise<MutationResult<T>> => {
        try {
            return await action()
        } catch {
            return { ok: false, error: fallbackError }
        }
    }

    const createNewRow = async () => {
        if (!createRow || isPending) return

        // createRow arranca como {}, que es truthy: sin esta guarda se podía crear vacío.
        if (invalidColumns(createRow).length > 0) return revealErrors()

        setIsPending(true)
        setAlert(null)

        const result = onCreateSave
            ? await runMutation(() => onCreateSave(createRow), "No se pudo crear el registro.")
            : { ok: true as const }

        setIsPending(false)

        if (!result.ok) {
            setAlert({ variant: "error", message: result.error ?? "No se pudo crear el registro." })
            return
        }

        // Solo tras confirmar en la base de datos agregamos la fila a la vista.
        setRows((prev) => [...prev, (result.row ?? createRow) as T])
        setAlert({ variant: "success", message: "Registro creado correctamente." })
        closeCreate()
    }

    const closeCreate = () => {
        setViewCreate(false)
        setCreateRow(null)
        setTouchedFields({})
        resetPhoneDrafts(null)
    }

    const closeView = () => {
        setViewRow(null)
        setEditedRow(null)
    }

    const openEdit = (row: T, index: number) => {
        const id = getRowId(row, index)
        setEditRowId(id)
        setEditedRow({ ...row })
        setTouchedFields({})
        resetPhoneDrafts(row)
    }

    const closeEdit = () => {
        setEditRowId(null)
        setEditedRow(null)
        setTouchedFields({})
        resetPhoneDrafts(null)
    }

    const saveEdit = async () => {
        if (editRowId === null || editedRow === null || isPending) return

        if (invalidColumns(editedRow).length > 0) return revealErrors()

        const updatedRow = editedRow as unknown as T
        setIsPending(true)
        setAlert(null)

        const result = onEditSave
            ? await runMutation(() => onEditSave(updatedRow, editRowId), "No se pudo guardar el registro.")
            : { ok: true as const }

        setIsPending(false)

        if (!result.ok) {
            setAlert({ variant: "error", message: result.error ?? "No se pudo guardar el registro." })
            return
        }

        // Actualizamos únicamente la fila afectada, sin recargar el resto.
        const confirmedRow = (result.row ?? updatedRow) as T
        setRows((prev) =>
            prev.map((r, i) => (getRowId(r, i) === editRowId ? { ...r, ...confirmedRow } : r))
        )
        setAlert({ variant: "success", message: "Registro actualizado correctamente." })
        closeEdit()
    }

    const confirmDelete = (row: T, index: number) => setIsConfirmId(getRowId(row, index))
    const cancelDelete = () => setIsConfirmId(null)
    const doDelete = async () => {
        if (isConfirmId === null || isPending) return
        const targetIndex = rows.findIndex((r, i) => getRowId(r, i) === isConfirmId)
        setIsPending(true)
        setAlert(null)

        const result = onDelete
            ? await runMutation(() => onDelete(isConfirmId, targetIndex), "No se pudo eliminar el registro.")
            : { ok: true as const }

        setIsPending(false)

        if (!result.ok) {
            setAlert({ variant: "error", message: result.error ?? "No se pudo eliminar el registro." })
            return
        }

        // Quitamos solo el elemento eliminado.
        setRows((prev) => prev.filter((r, i) => getRowId(r, i) !== isConfirmId))
        setAlert({ variant: "success", message: "Registro eliminado correctamente." })
        setIsConfirmId(null)
    }

    const filteredRows = useMemo(() => {
        const query = search.trim().toLowerCase()
        if (!query) return rows

        return rows.filter((row) =>
            header.some((column) => {
                const value = (row as any)[column]
                if (value === null || value === undefined) return false
                const text = formatCellValue(value).toLowerCase()
                return text.includes(query)
            }),
        )
    }, [rows, search, header])

    const getFieldValidation = (column: string, value: unknown): { error: string | null; validation: ValidationState; message: string } => {
        const normalized = column.toLowerCase()
        const text = String(value ?? "")
        let error: string | null = null
        let message = "Ingresa un valor."

        if (/\b(email|correo)\b/i.test(normalized)) {
            error = validateEmail(text)
            message = "Ingresa un correo electrónico."
        } else if (/\b(password|contraseña|pass)\b/i.test(normalized)) {
            error = validatePassword(text)
            message = "Ingresa una contraseña."
        } else if (isPhoneColumn(column)) {
            error = validatePhoneValue(text)
            message = "Ingresa un número de celular."
        } else if (/\b(user(name)?|usuario|nombre)\b/i.test(normalized)) {
            error = validateUsername(text)
            message = "Ingresa un nombre de usuario."
        }

        const validation: ValidationState = error ? "invalid" : text ? "valid" : "idle"
        return { error, validation, message }
    }

    /** Columnas que el usuario puede escribir en el modal actual. */
    const editableColumns = () => header.filter((column) => !readOnlyColumns.includes(column))

    /** Devuelve las columnas con error. Es la guarda que faltaba antes de enviar. */
    const invalidColumns = (row: Record<string, any> | null) =>
        editableColumns().filter((column) => Boolean(getFieldValidation(column, row?.[column]).error))

    // Al fallar el envío marcamos todo como tocado: renderField ya pinta el error
    // de cualquier campo tocado, así que no hace falta un estado de errores aparte.
    const revealErrors = () => {
        setTouchedFields(Object.fromEntries(editableColumns().map((column) => [column, true])))
        setAlert({ variant: "error", message: "Revisa los campos marcados." })
    }

    const renderField = (column: string, val: unknown, readOnly: boolean) => {
        const isBool = typeof val === "boolean"
        const isDateField = typeof val === "string" && (
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val) ||
            /^\d{4}-\d{2}-\d{2}$/.test(val) ||
            /\b(?:date|fecha|time|hora)\b/i.test(column)
        )
        const isCopyable = !isBool && !Array.isArray(val) && typeof val !== "object" && !isDateField
        const { error: rawError, validation: rawValidation, message } = !readOnly
            ? getFieldValidation(column, val)
            : { error: null, validation: "idle" as ValidationState, message: "" }
        const touched = !readOnly && Boolean(touchedFields[column])
        const error = touched ? rawError : null
        const validation = touched ? rawValidation : "idle" as ValidationState

        const updateField = (value: unknown) => {
            if (readOnly) return
            if (viewCreate) {
                setCreateRow((prev) => ({ ...(prev ?? {}), [column]: value }))
            } else if (editedRow !== null) {
                setEditedRow({ ...editedRow, [column]: value })
            }
        }

        if (isBool) {
            return (
                <label className="inline-flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={!!val}
                        disabled={readOnly}
                        onChange={(e) => updateField(e.target.checked)}
                        className="cursor-pointer rounded border-white/10 bg-white/5 text-accent disabled:cursor-not-allowed"
                    />
                    <span className="text-sm text-white/90">{val ? "Sí" : "No"}</span>
                </label>
            )
        }

        if (Array.isArray(val) || typeof val === "object") {
            return (
                <textarea
                    className="w-full bg-white/3 p-2 rounded text-sm"
                    rows={3}
                    readOnly={readOnly}
                    value={JSON.stringify(val)}
                    onChange={readOnly ? undefined : (e) => {
                        try {
                            updateField(JSON.parse(e.target.value))
                        } catch {
                            updateField(e.target.value)
                        }
                    }}
                />
            )
        }

        if (isCopyable && readOnly) {
            return (
                <CopyInput
                    value={String(val ?? "")}
                    readOnly
                    copyLabel="Copiar"
                    successLabel="Copiado"
                />
            )
        }

        if (isPhoneColumn(column) && !readOnly) {
            const draft = phoneDrafts[column] ?? splitPhoneNumber(String(val ?? ""))

            // El borrador vive en una ref además del estado: al cambiar de país,
            // PhoneInput avisa del nuevo indicativo y acto seguido trunca el número
            // si sobra. La ref se actualiza al instante, así que esa segunda llamada
            // ya lee el indicativo nuevo en vez del que acaba de quedar obsoleto.
            const updatePhone = (next: (prev: { code: string; number: string }) => { code: string; number: string }) => {
                const previous = phoneDraftsRef.current[column] ?? draft
                const updated = next(previous)

                phoneDraftsRef.current = { ...phoneDraftsRef.current, [column]: updated }
                setPhoneDrafts(phoneDraftsRef.current)

                // En la fila se guarda un único texto: el indicativo va solo al frente.
                const value = updated.number ? `${updated.code} ${updated.number}` : ""
                if (viewCreate) {
                    setCreateRow((prev) => ({ ...(prev ?? {}), [column]: value }))
                } else {
                    setEditedRow((prev) => (prev ? { ...prev, [column]: value } : prev))
                }
                setTouchedFields((prev) => ({ ...prev, [column]: true }))
            }

            return (
                <PhoneInput
                    label=""
                    codeValue={draft.code}
                    numberValue={draft.number}
                    onCodeChange={(value) => updatePhone((prev) => ({ code: value, number: prev.number }))}
                    onNumberChange={(e) => {
                        const value = e.target.value
                        updatePhone((prev) => ({ code: prev.code, number: value }))
                    }}
                    onBlur={() => setTouchedFields((prev) => ({ ...prev, [column]: true }))}
                    numberError={error ?? undefined}
                    message={message}
                    validation={validation}
                />
            )
        }

        return (
            <Input
                className="bg-white/3"
                value={String(val ?? "")}
                readOnly={readOnly}
                onChange={readOnly ? undefined : (e) => {
                    updateField(e.target.value)
                    setTouchedFields((prev) => ({ ...prev, [column]: true }))
                }}
                onBlur={readOnly ? undefined : () => setTouchedFields((prev) => ({ ...prev, [column]: true }))}
                error={readOnly ? undefined : error ?? undefined}
                message={readOnly ? undefined : message}
                validation={readOnly ? undefined : validation}
            />
        )
    }

    return (
        <div className={`w-full ${className}`} style={{ color: 'var(--color-foreground)' }}>
            {alert && (
                <div className="mb-3">
                    <Alert
                        variant={alert.variant}
                        message={alert.message}
                        onDismiss={() => setAlert(null)}
                    />
                </div>
            )}

            {/* Desktop / wide: standard polished table frame */}
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

                            <Button
                                onClick={openCreate}
                                variant="primary"
                                leftIcon={<Plus className="h-4 w-4" />}>
                                Agregar
                            </Button>
                        </div>

                        <table className="w-full border-collapse text-left text-sm" style={{ color: 'var(--color-foreground)' }}>
                            <thead>
                                <tr>
                                    {header.map((column) => (
                                        <th key={column} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--color-secondary)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                            {column}
                                        </th>
                                    ))}
                                    {showActions && (
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--color-secondary)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                            Acciones
                                        </th>
                                    )}
                                </tr>
                            </thead>

                            <tbody>
                                {filteredRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={header.length + (showActions ? 1 : 0)} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--color-secondary)' }}>
                                            No hay datos disponibles.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRows.map((row, rowIndex) => (
                                        <tr key={rowIndex} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') openView(row) }} className="group transition-colors hover:bg-white/3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25">
                                            {header.map((column, colIndex) => (
                                                <td key={`${rowIndex}-${column}`} className="px-4 py-4 align-middle" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <div
                                                        style={{
                                                            color: 'var(--color-foreground)',
                                                            fontWeight: colIndex === 0 ? 600 : 400
                                                        }}>
                                                        {formatCellValue((row as any)[column])}</div>
                                                </td>
                                            ))}

                                            {showActions && (
                                                <td className="px-4 py-4 align-middle text-right" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <div className="inline-flex items-center gap-2 *:cursor-pointer">
                                                        <button
                                                            type="button"
                                                            onClick={() => openView(row)}
                                                            aria-label="Ver"
                                                            title="Ver"
                                                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/3 text-(--color-foreground) transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-(--color-accent) focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => openEdit(row, rowIndex)}
                                                            aria-label="Editar"
                                                            title="Editar"
                                                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/3 text-(--color-foreground) transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-(--color-accent) focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => confirmDelete(row, rowIndex)}
                                                            aria-label="Eliminar"
                                                            title="Eliminar"
                                                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-400/20 bg-red-500/10 text-red-400 transition-all duration-200 hover:border-red-400/30 hover:bg-red-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/25"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Mobile: polished card frame */}
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
                        Agregar
                    </Button>
                </div>

                {filteredRows.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--color-secondary)' }}>No hay datos disponibles.</div>
                ) : (
                    filteredRows.map((row, rowIndex) => (
                        <div key={rowIndex} className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 6px 16px rgba(2,6,23,0.25)' }}>
                            <div className="p-4">
                                {header.map((column) => (
                                    <div key={`${rowIndex}-${column}`} className="flex items-start justify-between gap-3 py-2">
                                        <div className="text-xs font-medium" style={{ color: 'var(--color-secondary)' }}>{column}</div>
                                        <div className="text-sm" style={{ color: 'var(--color-foreground)' }}>{formatCellValue((row as any)[column])}</div>
                                    </div>
                                ))}

                                {showActions && (
                                    <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3 *:cursor-pointer">
                                        <button
                                            type="button"
                                            onClick={() => openView(row)}
                                            className="inline-flex h-9 items-center justify-center rounded-xl border border-white/10 bg-white/3 px-3 text-sm text-(--color-foreground) transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-(--color-accent)"
                                        >
                                            <Eye className="mr-2 h-4 w-4" />Ver
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => openEdit(row, rowIndex)}
                                            className="inline-flex h-9 items-center justify-center rounded-xl border border-white/10 bg-white/3 px-3 text-sm text-(--color-foreground) transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-(--color-accent)"
                                        >
                                            <Edit className="mr-2 h-4 w-4" />Editar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => confirmDelete(row, rowIndex)}
                                            className="inline-flex h-9 items-center justify-center rounded-xl border border-red-400/20 bg-red-500/10 px-3 text-sm text-red-400 transition-all duration-200 hover:border-red-400/30 hover:bg-red-500/15"
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />Eliminar
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create Modal */}
            <Modal isOpen={viewCreate} title="Crear registro" onClose={closeCreate}>
                <div className="flex flex-col gap-3">
                    {/* Los campos autogenerados (p. ej. la fecha) no se piden al crear. */}
                    {header.filter((column) => !readOnlyColumns.includes(column)).map((column) => (
                        <div key={column} className="flex flex-col gap-1">
                            <label className="text-xs text-secondary font-medium">{column}</label>
                            {renderField(column, createRow?.[column], false)}
                        </div>
                    ))}
                </div>
                <div className="flex items-center justify-end gap-2 mt-2">
                    <Button variant="ghost" onClick={closeCreate} disabled={isPending}>Cancelar</Button>
                    <Button variant="primary" onClick={createNewRow} disabled={isPending}>
                        {isPending ? "Creando..." : "Crear"}
                    </Button>
                </div>
            </Modal>

            {/* View Modal */}
            <Modal isOpen={!!viewRow} title="Ver registro" onClose={closeView}>

                <div className="flex flex-col gap-3">
                    {header.map((column) => (
                        <div key={column} className="flex flex-col gap-1">
                            <label className="text-xs text-secondary font-medium">{column}</label>
                            {renderField(column, editedRow?.[column], true)}
                        </div>
                    ))}
                </div>
            </Modal>

            {/* Edit Modal */}
            <Modal isOpen={editRowId !== null} title={editRowId !== null ? "Editar registro" : undefined} onClose={closeEdit}>
                {editedRow && (
                    <div className="flex flex-col gap-3">
                        {/* Los campos que genera la base de datos no se editan ni se muestran aquí. */}
                        {editableColumns().map((column) => (
                            <div key={column} className="flex flex-col gap-1">
                                <label className="text-xs text-secondary font-medium">{column}</label>
                                {renderField(column, editedRow[column], false)}
                            </div>
                        ))}

                        <div className="flex items-center justify-end gap-2 mt-2">
                            <Button variant="ghost" onClick={closeEdit} disabled={isPending}>Cancelar</Button>
                            <Button variant="primary" onClick={saveEdit} disabled={isPending}>
                                {isPending ? "Guardando..." : "Guardar"}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Confirm Delete Modal */}
            <Modal isOpen={isConfirmId !== null} title="Confirmar eliminación" onClose={cancelDelete}>
                <div className="text-sm text-white/90">¿Eliminar este registro? Esta acción no se puede deshacer.</div>
                <div className="flex items-center justify-end gap-2 mt-4">
                    <Button variant="ghost" onClick={cancelDelete} disabled={isPending}>Cancelar</Button>
                    <Button variant="primary" onClick={doDelete} disabled={isPending}>
                        {isPending ? "Eliminando..." : "Eliminar"}
                    </Button>
                </div>
            </Modal>
        </div>
    )
}
