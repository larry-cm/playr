"use client"

import { useId, useMemo, useRef, useState, type ReactNode } from "react"
import Button from "@ui/button"
import Input from "@ui/input"
import type { ValidationState } from "@ui/input"
import Modal from "@ui/modal"
import CopyInput from "@ui/copy-input"
import PhoneInput from "@ui/phone-input"
import PasswordInput from "@ui/password-input"
import Select from "@ui/select"
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

/** Campo que solo se pide al crear (no es columna de la tabla), p. ej. contraseña o rol. Su valor va en onCreateSave bajo `key`. */
export interface CreateField {
    key: string;
    label: string;
    type: "password" | "select";
    /** Opciones del select; la primera es el valor inicial. */
    options?: { value: string; label: string }[];
    /** Devuelve el mensaje de error o null si el valor es válido. */
    validate?: (value: string) => string | null;
    /** Ayuda neutra bajo el campo. */
    hint?: string;
}

type Row = Record<string, unknown>

interface TableProps<T extends Row> {
    header: string[];
    data: T[];
    className?: string;
    showActions?: boolean;
    /** Columnas que se muestran pero no se pueden editar ni escribir al crear. */
    readOnlyColumns?: string[];
    onEditSave?: (row: T, id: string | number) => Promise<MutationResult<T>> | MutationResult<T>;
    /** id = Id/id de la fila (texto); index = posición en `data` (sin filtrar). */
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
    /** Encabezado de la sección dentro del marco (SectionHeader), como en las tarjetas del panel. */
    heading?: ReactNode;
    /** Controles propios junto al buscador (p. ej. filtros); la tabla solo los muestra, el filtrado lo hace quien pasa data. */
    filters?: (layout: "desktop" | "mobile") => ReactNode;
    /** Nombre de lo que lista la tabla, en singular y minúscula: "Ver cliente", "Crear cliente"... Por defecto "registro". */
    entityName?: string;
    /** Campos extra que solo aparecen en el modal de crear. */
    createFields?: CreateField[];
}

const ALL_BUILTIN_ACTIONS = ["view", "edit", "delete"] as const

/** El modal infiere el tipo de campo por el nombre de la columna. */
const isPhoneColumn = (column: string) => /\b(tel[eé]fono|celular|phone|m[oó]vil)\b/i.test(column)

/** Id estable de la fila: su Id/id, o su posición en los datos SIN filtrar (nunca la del resultado de la búsqueda). */
const rowIdOf = (row: Row, index: number): string => {
    const id = row.Id ?? row.id
    return id === null || id === undefined ? `fila-${index}` : String(id)
}

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

export default function Table<T extends Row>({
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
    heading,
    filters,
    entityName = "registro",
    createFields = [],
}: Readonly<TableProps<T>>) {
    const fieldIdBase = useId()
    const fieldId = (key: string) => `${fieldIdBase}-${key.replace(/\W/g, "_")}`
    const actionCount = Math.max(1, builtinActions.length + (extraActions ? 1 : 0))

    // Copia local de las filas para pintar al instante lo que el servidor confirmó (crear/editar/eliminar). Cuando el
    // padre manda datos nuevos, esos mandan: se ajusta durante el render (patrón de React), sin setState en un efecto.
    const [rows, setRows] = useState<T[]>(data)
    const [prevData, setPrevData] = useState<T[]>(data)
    if (data !== prevData) {
        setPrevData(data)
        setRows(data)
    }

    const [alert, setAlert] = useState<{ variant: "success" | "error"; message: string } | null>(null)
    /** Error de la operación del modal abierto: se muestra dentro del modal, no detrás del fondo. */
    const [modalError, setModalError] = useState<string | null>(null)
    const [isPending, setIsPending] = useState(false)
    const [viewRow, setViewRow] = useState<T | null>(null)
    const [viewCreate, setViewCreate] = useState<boolean>(false)
    const [createRow, setCreateRow] = useState<Row | null>(null)
    const [editRowId, setEditRowId] = useState<string | null>(null)
    const [editedRow, setEditedRow] = useState<Row | null>(null)
    const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})
    // El indicativo y el número se editan por separado. Si se recalcularan desde el
    // texto guardado en cada tecla, un valor a medias como "+57 3" volvería a leerse
    // como el número "573" y el indicativo se iría acumulando.
    const [phoneDrafts, setPhoneDrafts] = useState<Record<string, { code: string; number: string }>>({})
    const phoneDraftsRef = useRef<Record<string, { code: string; number: string }>>({})
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [search, setSearch] = useState("")

    const indexedRows = useMemo(() => rows.map((row, index) => ({ row, id: rowIdOf(row, index), index })), [rows])

    /** Nombre legible de una fila para los mensajes: el valor de la primera columna. */
    const nameOf = (row: Row | null | undefined) => {
        const value = row && header[0] ? row[header[0]] : null
        return value === null || value === undefined || value === "" ? null : formatCellValue(value)
    }

    // Siembra los borradores de teléfono al abrir un modal y los limpia al cerrarlo.
    const resetPhoneDrafts = (row?: Row | null) => {
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
        // Los select arrancan en su primera opción (p. ej. Rol = Cliente).
        setCreateRow(Object.fromEntries(createFields.filter((f) => f.type === "select" && f.options?.length).map((f) => [f.key, f.options![0].value])))
        setTouchedFields({})
        setModalError(null)
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
        if (invalidColumns(createRow, true).length > 0) return revealErrors(true)

        setIsPending(true)
        setModalError(null)
        setAlert(null)

        const result = onCreateSave
            ? await runMutation(() => onCreateSave(createRow), `No se pudo crear el ${entityName}.`)
            : { ok: true as const }

        setIsPending(false)

        if (!result.ok) {
            setModalError(result.error ?? `No se pudo crear el ${entityName}.`)
            return
        }

        // Solo tras confirmar en la base de datos agregamos la fila a la vista. Los campos solo-de-creación
        // (contraseña, rol) no son columnas: no pasan a la fila.
        const fallbackRow = Object.fromEntries(Object.entries(createRow).filter(([key]) => !createFields.some((f) => f.key === key)))
        setRows((prev) => [...prev, (result.row ?? fallbackRow) as T])
        setAlert({ variant: "success", message: `${capitalizarPrimera(entityName)} creado correctamente.` })
        closeCreate()
    }

    const closeCreate = () => {
        setViewCreate(false)
        setCreateRow(null)
        setTouchedFields({})
        setModalError(null)
        resetPhoneDrafts(null)
    }

    const closeView = () => {
        setViewRow(null)
        setEditedRow(null)
    }

    const openEdit = (row: T, id: string) => {
        setEditRowId(id)
        setEditedRow({ ...row })
        setTouchedFields({})
        setModalError(null)
        resetPhoneDrafts(row)
    }

    const closeEdit = () => {
        setEditRowId(null)
        setEditedRow(null)
        setTouchedFields({})
        setModalError(null)
        resetPhoneDrafts(null)
    }

    const saveEdit = async () => {
        if (editRowId === null || editedRow === null || isPending) return

        if (invalidColumns(editedRow, false).length > 0) return revealErrors(false)

        const updatedRow = editedRow as T
        setIsPending(true)
        setModalError(null)
        setAlert(null)

        const result = onEditSave
            ? await runMutation(() => onEditSave(updatedRow, editRowId), "No se pudieron guardar los cambios.")
            : { ok: true as const }

        setIsPending(false)

        if (!result.ok) {
            setModalError(result.error ?? "No se pudieron guardar los cambios.")
            return
        }

        // Actualizamos únicamente la fila afectada, sin recargar el resto.
        const confirmedRow = (result.row ?? updatedRow) as T
        const targetId = editRowId
        setRows((prev) => prev.map((r, i) => (rowIdOf(r, i) === targetId ? { ...r, ...confirmedRow } : r)))
        setAlert({ variant: "success", message: `${capitalizarPrimera(entityName)} actualizado correctamente.` })
        closeEdit()
    }

    const deleteTarget = deleteId === null ? null : indexedRows.find((r) => r.id === deleteId) ?? null
    const openDelete = (id: string) => {
        setModalError(null)
        setDeleteId(id)
    }
    const cancelDelete = () => {
        setDeleteId(null)
        setModalError(null)
    }
    const doDelete = async () => {
        if (deleteId === null || isPending) return
        const targetId = deleteId
        const targetIndex = indexedRows.findIndex((r) => r.id === targetId)
        setIsPending(true)
        setModalError(null)
        setAlert(null)

        const result = onDelete
            ? await runMutation(() => onDelete(targetId, targetIndex), `No se pudo eliminar el ${entityName}.`)
            : { ok: true as const }

        setIsPending(false)

        if (!result.ok) {
            setModalError(result.error ?? `No se pudo eliminar el ${entityName}.`)
            return
        }

        // Quitamos solo el elemento eliminado.
        setRows((prev) => prev.filter((r, i) => rowIdOf(r, i) !== targetId))
        setAlert({ variant: "success", message: `${capitalizarPrimera(entityName)} eliminado correctamente.` })
        setDeleteId(null)
    }

    const filteredRows = useMemo(() => {
        const query = search.trim().toLowerCase()
        if (!query) return indexedRows

        return indexedRows.filter(({ row }) =>
            header.some((column) => {
                const value = row[column]
                if (value === null || value === undefined) return false
                const text = formatCellValue(value).toLowerCase()
                return text.includes(query)
            }),
        )
    }, [indexedRows, search, header])

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

    const createFieldError = (field: CreateField, row: Row | null) => field.validate?.(String(row?.[field.key] ?? "")) ?? null

    /** Devuelve las columnas (y, al crear, los campos extra) con error. Es la guarda antes de enviar. */
    const invalidColumns = (row: Row | null, creating: boolean) => [
        ...editableColumns().filter((column) => Boolean(getFieldValidation(column, row?.[column]).error)),
        ...(creating ? createFields.filter((field) => createFieldError(field, row)).map((field) => field.key) : []),
    ]

    // Al fallar el envío marcamos todo como tocado: renderField ya pinta el error
    // de cualquier campo tocado, así que no hace falta un estado de errores aparte.
    const revealErrors = (creating: boolean) => {
        const keys = [...editableColumns(), ...(creating ? createFields.map((f) => f.key) : [])]
        setTouchedFields(Object.fromEntries(keys.map((key) => [key, true])))
        setModalError("Revisa los campos marcados.")
    }

    const touch = (key: string) => setTouchedFields((prev) => ({ ...prev, [key]: true }))

    const renderField = (column: string, val: unknown, readOnly: boolean) => {
        const id = fieldId(column)
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
                        id={id}
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
                    id={id}
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
                    id={id}
                    value={String(val ?? "")}
                    readOnly
                    copyLabel={`Copiar ${column.toLowerCase()}`}
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
                touch(column)
            }

            return (
                <PhoneInput
                    id={id}
                    label=""
                    codeValue={draft.code}
                    numberValue={draft.number}
                    onCodeChange={(value) => updatePhone((prev) => ({ code: value, number: prev.number }))}
                    onNumberChange={(e) => {
                        const value = e.target.value
                        updatePhone((prev) => ({ code: prev.code, number: value }))
                    }}
                    onBlur={() => touch(column)}
                    numberError={error ?? undefined}
                    message={message}
                    validation={validation}
                />
            )
        }

        const isEmail = /\b(email|correo)\b/i.test(column)
        return (
            <Input
                id={id}
                className="bg-white/3"
                type={isEmail ? "email" : "text"}
                autoComplete={readOnly ? undefined : isEmail ? "email" : "off"}
                value={String(val ?? "")}
                readOnly={readOnly}
                onChange={readOnly ? undefined : (e) => {
                    updateField(e.target.value)
                    touch(column)
                }}
                onBlur={readOnly ? undefined : () => touch(column)}
                error={readOnly ? undefined : error ?? undefined}
                message={readOnly ? undefined : message}
                validation={readOnly ? undefined : validation}
            />
        )
    }

    const renderCreateField = (field: CreateField) => {
        const value = String(createRow?.[field.key] ?? "")
        const error = touchedFields[field.key] ? createFieldError(field, createRow) : null
        const update = (next: string) => {
            setCreateRow((prev) => ({ ...(prev ?? {}), [field.key]: next }))
            touch(field.key)
        }

        if (field.type === "password") {
            return (
                <PasswordInput
                    id={fieldId(field.key)}
                    name={field.key}
                    label={field.label}
                    autoComplete="new-password"
                    value={value}
                    onChange={(e) => update(e.target.value)}
                    onBlur={() => touch(field.key)}
                    error={error ?? undefined}
                    message={field.hint}
                    validation={error ? "invalid" : touchedFields[field.key] && value ? "valid" : "idle"}
                    required
                />
            )
        }

        return (
            <Select
                id={fieldId(field.key)}
                name={field.key}
                label={field.label}
                value={value}
                onChange={(e) => update(e.target.value)}
                options={field.options ?? []}
                error={error ?? undefined}
                required
            />
        )
    }

    const toolbar = (mobile: boolean) => (
        <>
            {filters ? (
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <SearchInput value={search} onChange={setSearch} className={mobile ? "w-full" : "w-full lg:w-72"} />
                    {filters(mobile ? "mobile" : "desktop")}
                </div>
            ) : (
                <SearchInput value={search} onChange={setSearch} className={mobile ? "w-full" : undefined} />
            )}
            {!hideCreate && (
                <Button onClick={openCreate} variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
                    Agregar
                </Button>
            )}
        </>
    )

    const canView = builtinActions.includes("view")
    const deleteName = nameOf(deleteTarget?.row)

    return (
        <div className={`w-full ${className}`} style={{ color: 'var(--color-foreground)' }}>
            {alert && (
                <div className="mb-4">
                    <Alert
                        variant={alert.variant}
                        message={alert.message}
                        onDismiss={() => setAlert(null)}
                        autoDismissMs={alert.variant === "success" ? 5000 : undefined}
                    />
                </div>
            )}

            {/* Marco, densidad y alto compartidos con el resto de tablas del panel (app/ui/data-frame.tsx). */}
            <TableFrame toolbar={toolbar(false)} heading={heading}>
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
                        filteredRows.map(({ row, id }) => (
                            <tr
                                key={id}
                                tabIndex={canView ? 0 : undefined}
                                onKeyDown={canView ? (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) openView(row) } : undefined}
                                className={`${ROW_CLASS} focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25`}
                            >
                                {header.map((column, colIndex) => (
                                    <Td key={column} className={colIndex === 0 ? "font-semibold" : ""}>
                                        {formatCellValue(row[column])}
                                    </Td>
                                ))}

                                {showActions && (
                                    <ActionsCell>
                                        {canView && <IconAction icon={Eye} label={`Ver ${nameOf(row) ?? entityName}`} title="Ver" onClick={() => openView(row)} />}
                                        {builtinActions.includes("edit") && <IconAction icon={Edit} label={`Editar ${nameOf(row) ?? entityName}`} title="Editar" onClick={() => openEdit(row, id)} />}
                                        {builtinActions.includes("delete") && <IconAction icon={Trash2} label={`Eliminar ${nameOf(row) ?? entityName}`} title="Eliminar" tone="danger" onClick={() => openDelete(id)} />}
                                        {extraActions?.(row, "desktop")}
                                    </ActionsCell>
                                )}
                            </tr>
                        ))
                    )}
                </tbody>
            </TableFrame>

            <MobileFrame toolbar={toolbar(true)} heading={heading}>
                {loading ? (
                    Array.from({ length: 3 }, (_, i) => (
                        <MobileCard
                            key={`skeleton-${i}`}
                            fields={header.map((column) => ({ label: column, value: <span className="inline-block h-4 w-24 animate-pulse rounded bg-white/5 align-middle" /> }))}
                            actions={showActions ? Array.from({ length: actionCount }, (_, button) => (
                                <div key={button} className="h-11 w-20 animate-pulse rounded-xl bg-white/5" />
                            )) : undefined}
                        />
                    ))
                ) : filteredRows.length === 0 ? (
                    <MobileEmpty>No hay datos disponibles.</MobileEmpty>
                ) : (
                    filteredRows.map(({ row, id }) => (
                        <MobileCard
                            key={id}
                            fields={header.map((column) => ({ label: column, value: formatCellValue(row[column]) }))}
                            actions={showActions ? (
                                <>
                                    {canView && <MobileAction icon={Eye} label="Ver" onClick={() => openView(row)} />}
                                    {builtinActions.includes("edit") && <MobileAction icon={Edit} label="Editar" onClick={() => openEdit(row, id)} />}
                                    {builtinActions.includes("delete") && <MobileAction icon={Trash2} label="Eliminar" tone="danger" onClick={() => openDelete(id)} />}
                                    {extraActions?.(row, "mobile")}
                                </>
                            ) : undefined}
                        />
                    ))
                )}
            </MobileFrame>

            {/* Create Modal */}
            <Modal isOpen={viewCreate} title={`Crear ${entityName}`} onClose={closeCreate} dismissible={!isPending}>
                <div className="flex flex-col gap-3">
                    {modalError && <Alert variant="error" message={modalError} />}
                    {/* Los campos autogenerados (p. ej. la fecha) no se piden al crear. */}
                    {editableColumns().map((column) => (
                        <div key={column} className="flex flex-col gap-1">
                            <label htmlFor={fieldId(column)} className="text-xs text-secondary font-medium">{column}</label>
                            {renderField(column, createRow?.[column], false)}
                        </div>
                    ))}
                    {createFields.map((field) => (
                        <div key={field.key}>{renderCreateField(field)}</div>
                    ))}
                </div>
                <div className="flex items-center justify-end gap-2 mt-2">
                    <Button variant="ghost" onClick={closeCreate} disabled={isPending}>Cancelar</Button>
                    <Button variant="primary" onClick={createNewRow} isLoading={isPending}>
                        {isPending ? "Creando..." : "Crear"}
                    </Button>
                </div>
            </Modal>

            {/* View Modal */}
            <Modal isOpen={!!viewRow} title={`Ver ${entityName}`} onClose={closeView}>
                <div className="flex flex-col gap-3">
                    {header.map((column) => (
                        <div key={column} className="flex flex-col gap-1">
                            <label htmlFor={fieldId(column)} className="text-xs text-secondary font-medium">{column}</label>
                            {renderField(column, editedRow?.[column], true)}
                        </div>
                    ))}
                </div>
            </Modal>

            {/* Edit Modal */}
            <Modal isOpen={editRowId !== null} title={`Editar ${entityName}`} onClose={closeEdit} dismissible={!isPending}>
                {editedRow && (
                    <div className="flex flex-col gap-3">
                        {modalError && <Alert variant="error" message={modalError} />}
                        {/* Los campos que genera la base de datos no se editan ni se muestran aquí. */}
                        {editableColumns().map((column) => (
                            <div key={column} className="flex flex-col gap-1">
                                <label htmlFor={fieldId(column)} className="text-xs text-secondary font-medium">{column}</label>
                                {renderField(column, editedRow[column], false)}
                            </div>
                        ))}

                        <div className="flex items-center justify-end gap-2 mt-2">
                            <Button variant="ghost" onClick={closeEdit} disabled={isPending}>Cancelar</Button>
                            <Button variant="primary" onClick={saveEdit} isLoading={isPending}>
                                {isPending ? "Guardando..." : "Guardar"}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Confirm Delete Modal */}
            <Modal isOpen={deleteId !== null} title={`Eliminar ${entityName}`} onClose={cancelDelete} dismissible={!isPending}>
                <div className="flex flex-col gap-3">
                    {modalError && <Alert variant="error" message={modalError} />}
                    <p className="text-sm text-white/90">
                        {deleteName ? <>¿Eliminar <strong className="font-semibold text-white">{deleteName}</strong>?</> : `¿Eliminar este ${entityName}?`} Esta acción no se puede deshacer.
                    </p>
                </div>
                <div className="flex items-center justify-end gap-2 mt-4">
                    <Button variant="ghost" onClick={cancelDelete} disabled={isPending}>Cancelar</Button>
                    <Button variant="danger" onClick={doDelete} isLoading={isPending}>
                        {isPending ? "Eliminando..." : "Eliminar"}
                    </Button>
                </div>
            </Modal>
        </div>
    )
}

const capitalizarPrimera = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
