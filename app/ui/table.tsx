"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Button from "@ui/button"
import Input from "@ui/input"
import type { ValidationState } from "@ui/input"
import Modal from "@ui/modal"
import CopyInput from "@ui/copy-input"
import PhoneInput from "@ui/phone-input"
import Alert from "@ui/alert"
import { Eye, Edit, Trash2, Plus } from "lucide-react"
import { ActionsCell, ActionsTh, EmptyRow, IconAction, MobileAction, MobileCard, MobileEmpty, MobileFrame, ROW_CLASS, SearchInput, TableFrame, Td, Th } from "@ui/data-frame"
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
    /** True mientras llegan los datos: muestra filas de carga con la misma geometría que las reales. */
    loading?: boolean;
    /** Oculta el botón "Agregar" (tablas de solo lectura, p. ej. la Bodega). */
    hideCreate?: boolean;
    /** Acciones integradas que se muestran en cada fila. Por defecto: ver, editar y eliminar. */
    builtinActions?: ReadonlyArray<"view" | "edit" | "delete">;
    /** Acciones propias al final de cada fila: solo ícono en escritorio, con texto en móvil. */
    extraActions?: (row: T, layout: "desktop" | "mobile") => ReactNode;
}

const ALL_BUILTIN_ACTIONS = ["view", "edit", "delete"] as const

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
    loading = false,
    hideCreate = false,
    builtinActions = ALL_BUILTIN_ACTIONS,
    extraActions,
}: Readonly<TableProps<T>>) {
    const actionCount = Math.max(1, builtinActions.length + (extraActions ? 1 : 0))
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
                const value = row[column]
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

    const toolbar = (mobile: boolean) => (
        <>
            <SearchInput value={search} onChange={setSearch} className={mobile ? "w-full" : undefined} />
            {!hideCreate && (
                <Button onClick={openCreate} variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
                    Agregar
                </Button>
            )}
        </>
    )

    return (
        <div className={`w-full ${className}`} style={{ color: 'var(--color-foreground)' }}>
            {alert && (
                <div className="mb-4">
                    <Alert
                        variant={alert.variant}
                        message={alert.message}
                        onDismiss={() => setAlert(null)}
                    />
                </div>
            )}

            {/* Marco, densidad y alto compartidos con el resto de tablas del panel (app/ui/data-frame.tsx). */}
            <TableFrame toolbar={toolbar(false)}>
                <thead>
                    <tr>
                        {header.map((column) => <Th key={column}>{column}</Th>)}
                        {showActions && <ActionsTh />}
                    </tr>
                </thead>

                <tbody>
                    {loading ? (
                        Array.from({ length: 4 }, (_, i) => (
                            <tr key={`skeleton-${i}`}>
                                {header.map((column) => (
                                    <Td key={column}>
                                        <div className="h-5 w-full animate-pulse rounded-md bg-white/5" />
                                    </Td>
                                ))}
                                {showActions && (
                                    <ActionsCell>
                                        {Array.from({ length: actionCount }, (_, button) => (
                                            <div key={button} className="h-9 w-9 animate-pulse rounded-xl bg-white/5" />
                                        ))}
                                    </ActionsCell>
                                )}
                            </tr>
                        ))
                    ) : filteredRows.length === 0 ? (
                        <EmptyRow colSpan={header.length + (showActions ? 1 : 0)}>No hay datos disponibles.</EmptyRow>
                    ) : (
                        filteredRows.map((row, rowIndex) => (
                            <tr key={rowIndex} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') openView(row) }} className={`${ROW_CLASS} focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25`}>
                                {header.map((column, colIndex) => (
                                    <Td key={`${rowIndex}-${column}`} className={colIndex === 0 ? "font-semibold" : ""}>
                                        {formatCellValue(row[column])}
                                    </Td>
                                ))}

                                {showActions && (
                                    <ActionsCell>
                                        {builtinActions.includes("view") && <IconAction icon={Eye} label="Ver" onClick={() => openView(row)} />}
                                        {builtinActions.includes("edit") && <IconAction icon={Edit} label="Editar" onClick={() => openEdit(row, rowIndex)} />}
                                        {builtinActions.includes("delete") && <IconAction icon={Trash2} label="Eliminar" tone="danger" onClick={() => confirmDelete(row, rowIndex)} />}
                                        {extraActions?.(row, "desktop")}
                                    </ActionsCell>
                                )}
                            </tr>
                        ))
                    )}
                </tbody>
            </TableFrame>

            <MobileFrame toolbar={toolbar(true)}>
                {loading ? (
                    Array.from({ length: 3 }, (_, i) => (
                        <MobileCard
                            key={`skeleton-${i}`}
                            fields={header.map((column) => ({ label: column, value: <span className="inline-block h-4 w-24 animate-pulse rounded bg-white/5 align-middle" /> }))}
                            actions={showActions ? Array.from({ length: actionCount }, (_, button) => (
                                <div key={button} className="h-9 w-20 animate-pulse rounded-xl bg-white/5" />
                            )) : undefined}
                        />
                    ))
                ) : filteredRows.length === 0 ? (
                    <MobileEmpty>No hay datos disponibles.</MobileEmpty>
                ) : (
                    filteredRows.map((row, rowIndex) => (
                        <MobileCard
                            key={rowIndex}
                            fields={header.map((column) => ({ label: column, value: formatCellValue(row[column]) }))}
                            actions={showActions ? (
                                <>
                                    {builtinActions.includes("view") && <MobileAction icon={Eye} label="Ver" onClick={() => openView(row)} />}
                                    {builtinActions.includes("edit") && <MobileAction icon={Edit} label="Editar" onClick={() => openEdit(row, rowIndex)} />}
                                    {builtinActions.includes("delete") && <MobileAction icon={Trash2} label="Eliminar" tone="danger" onClick={() => confirmDelete(row, rowIndex)} />}
                                    {extraActions?.(row, "mobile")}
                                </>
                            ) : undefined}
                        />
                    ))
                )}
            </MobileFrame>

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
