"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useRuta } from "@/app/administrar/sesion-tab"
import Card from "@ui/card"
import Button from "@ui/button"
import Input from "@ui/input"
import CopyInput from "@ui/copy-input"
import PasswordInput from "@ui/password-input"
import SelectDropdown from "@ui/select-dropdown"
import Modal from "@ui/modal"
import Alert from "@ui/alert"
import { AlertCircle, Eye, Pencil, RefreshCw, Trash2 } from "lucide-react"
import { ActionsCell, ActionsTh, EmptyRow, IconAction, MobileAction, MobileCard, MobileEmpty, MobileFrame, ROW_CLASS, SearchInput, SkeletonCards, SkeletonRows, TableFrame, Td, Th } from "@ui/data-frame"
import type { PerfilRow } from "@action/manager-and-admin/perfiles/get-all-perfiles-action"
import { editPerfilAction } from "@action/manager-and-admin/perfiles/edit-perfil-action"
import { deletePerfilAction } from "@action/manager-and-admin/perfiles/delete-perfil-action"
import { getClavePerfilAction } from "@action/manager-and-admin/perfiles/get-clave-perfil-action"
import type { ClavePerfil } from "@lib/claves"
import { accessTypeLabel } from "@lib/access-type"
import { formatDateOnly } from "@lib/date"
import { capitalizar } from "@lib/text"
import FiltrosSelect, { pasaFiltro, sinFiltro, type Filtro } from "@ui/filtros-select"
import { CAMPOS_PERFILES, estadoColor, estadoLabel } from "@/app/administrar/perfiles/filtros-perfiles"

const estadoOptions = (Object.keys(estadoLabel) as PerfilRow["estado"][]).map((value) => ({
    value,
    label: estadoLabel[value],
}))

const COLUMNAS = ["Plataforma", "Correo", "Perfil", "Estado", "Vencimiento"]

interface PerfilesClientProps {
    /** undefined = la página aún carga (loading.tsx) · null = error */
    initialPerfiles: PerfilRow[] | null | undefined
    /** Cuenta con la que abre el filtro de correo (viene de Cuentas → "Ver perfiles"); null = todas. */
    initialCuentaId?: number | null
}

export default function PerfilesClient({ initialPerfiles, initialCuentaId = null }: PerfilesClientProps) {
    const ruta = useRuta()
    const router = useRouter()
    const [perfiles, setPerfiles] = useState<PerfilRow[] | null | undefined>(initialPerfiles)
    // Cuando el servidor manda datos nuevos (Reintentar, o el revalidatePath de una acción) mandan esos.
    const [prevInitial, setPrevInitial] = useState(initialPerfiles)
    if (initialPerfiles !== prevInitial) {
        setPrevInitial(initialPerfiles)
        setPerfiles(initialPerfiles)
    }
    const [alert, setAlert] = useState<{ variant: "success" | "error"; message: string } | null>(null)
    /** Error de la operación del modal abierto: se muestra dentro del modal, no detrás del fondo. */
    const [modalError, setModalError] = useState<string | null>(null)
    const [isPending, setIsPending] = useState(false)
    const [reintentando, startReintento] = useTransition()

    const [editingId, setEditingId] = useState<number | null>(null)
    const [editEstado, setEditEstado] = useState<PerfilRow["estado"]>("disponible")
    const [editNombre, setEditNombre] = useState("")
    const [editPin, setEditPin] = useState("")
    const [editEmail, setEditEmail] = useState("")
    // null = sin tocar: el campo muestra la contraseña vigente (del proveedor) y no se envía.
    const [editPassword, setEditPassword] = useState<string | null>(null)

    const [viewingId, setViewingId] = useState<number | null>(null)
    const [deletingId, setDeletingId] = useState<number | null>(null)
    const [search, setSearch] = useState("")
    const [filtro, setFiltro] = useState<Filtro>({ ...sinFiltro(CAMPOS_PERFILES), cuenta: initialCuentaId === null ? "" : String(initialCuentaId) })

    const filteredPerfiles = useMemo(() => {
        const query = search.trim().toLowerCase()
        const filtrados = (perfiles ?? []).filter((row) => pasaFiltro(row, CAMPOS_PERFILES, filtro))
        if (!query) return filtrados
        return filtrados.filter((row) =>
            [row.platform_nombre, row.cuenta_email, row.nombre_perfil, estadoLabel[row.estado]]
                .some((value) => value.toLowerCase().includes(query))
        )
    }, [perfiles, search, filtro])

    // La URL refleja la cuenta elegida: así el enlace de Cuentas y un recargo abren con el mismo filtro de correo. Todos los
    // perfiles ya están cargados y se filtran aquí, así que basta con reescribir la URL (history.replaceState, que Next
    // integra con su router) sin router.replace, que volvería a renderizar la página en el servidor.
    const cambiarFiltro = (nuevo: Filtro) => {
        if (nuevo.cuenta !== filtro.cuenta) {
            window.history.replaceState(null, "", ruta(nuevo.cuenta ? `/administrar/perfiles?cuenta=${nuevo.cuenta}` : "/administrar/perfiles"))
        }
        setFiltro(nuevo)
    }

    const toolbar = (mobile: boolean) => (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <SearchInput value={search} onChange={setSearch} className={mobile ? "w-full" : "w-full lg:w-72"} />
            <FiltrosSelect campos={CAMPOS_PERFILES} items={perfiles ?? []} value={filtro} onChange={cambiarFiltro} mobile={mobile} />
        </div>
    )

    const editingRow = perfiles?.find((row) => row.id === editingId) ?? null
    const viewingRow = perfiles?.find((row) => row.id === viewingId) ?? null

    // La contraseña de cada perfil es la editada (si la tiene) o la del proveedor en vivo (tarda unos segundos): se pide al
    // abrir Ver/Editar y se guarda por perfil. Un error no se guarda: al reabrir se reintenta.
    const [claves, setClaves] = useState<Record<number, "cargando" | ClavePerfil>>({})

    const cargarClave = async (row: PerfilRow) => {
        const actual = claves[row.id]
        if (actual === "cargando" || (actual && actual.ok)) return
        setClaves((prev) => ({ ...prev, [row.id]: "cargando" }))
        const res = await getClavePerfilAction(row.id)
        setClaves((prev) => ({ ...prev, [row.id]: res }))
    }

    const campoClave = (row: PerfilRow) => {
        const clave = claves[row.id]
        if (!clave || clave === "cargando") return { value: "", placeholder: "Consultando al proveedor...", error: undefined }
        return clave.ok ? { value: clave.password, placeholder: "--", error: undefined } : { value: "", placeholder: "--", error: clave.error }
    }

    const openView = (row: PerfilRow) => {
        setViewingId(row.id)
        void cargarClave(row)
    }

    const openDelete = (id: number) => {
        setModalError(null)
        setDeletingId(id)
    }

    const cancelDelete = () => {
        setDeletingId(null)
        setModalError(null)
    }

    const openEdit = (row: PerfilRow) => {
        setModalError(null)
        setEditingId(row.id)
        setEditEstado(row.estado)
        setEditNombre(row.nombre_perfil)
        setEditPin(row.pin ?? "")
        setEditEmail(row.cuenta_email)
        setEditPassword(null)
        void cargarClave(row)
    }

    const cancelEdit = () => {
        setEditingId(null)
        setModalError(null)
    }

    // Editar y eliminar actualizan la tabla en local, sin router.refresh(): las acciones ya revalidan Cuentas y la Tienda
    // (revalidatePath), que es donde importa el estado del perfil.
    const saveEdit = async () => {
        if (editingId === null || isPending) return
        const id = editingId
        const row = perfiles?.find((r) => r.id === id)
        if (!row) return
        const vigente = campoClave(row).value
        const password = editPassword !== null && editPassword.trim() !== vigente ? editPassword.trim() : undefined
        const email = editEmail.trim().toLowerCase()

        setIsPending(true)
        setModalError(null)
        setAlert(null)
        const error = await editPerfilAction({ id, estado: editEstado, nombre_perfil: editNombre, pin: editPin, email, password })
            .catch(() => "No se pudo guardar el perfil. Inténtalo de nuevo.")
        setIsPending(false)

        if (error) {
            setModalError(error)
            return
        }

        // Solo cambia este perfil: los demás de la cuenta conservan sus datos.
        setPerfiles((prev) =>
            (prev ?? []).map((r) =>
                r.id === id
                    ? { ...r, estado: editEstado, nombre_perfil: editNombre.trim(), pin: editPin.trim() || null, cuenta_email: email }
                    : r
            )
        )
        if (password !== undefined) setClaves((prev) => ({ ...prev, [row.id]: { ok: true, password } }))
        setAlert({ variant: "success", message: "Perfil actualizado correctamente." })
        setEditingId(null)
    }

    const confirmDelete = async () => {
        if (deletingId === null || isPending) return
        const id = deletingId
        setIsPending(true)
        setModalError(null)
        setAlert(null)
        const error = await deletePerfilAction({ id }).catch(() => "No se pudo eliminar el perfil. Inténtalo de nuevo.")
        setIsPending(false)

        if (error) {
            setModalError(error)
            return
        }

        setPerfiles((prev) => (prev ?? []).filter((row) => row.id !== id))
        setAlert({ variant: "success", message: "Perfil eliminado correctamente." })
        setDeletingId(null)
    }

    if (perfiles === null) {
        return (
            <Card padding="px-4 py-12" className="flex flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400 mb-4 shadow-lg shadow-red-500/5">
                    <AlertCircle className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">Error al cargar los perfiles</h3>
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
                    {perfiles === undefined ? (
                        <SkeletonRows columns={COLUMNAS.length} actions={3} />
                    ) : filteredPerfiles.length === 0 ? (
                        <EmptyRow colSpan={6}>{perfiles?.length ? "Ningún perfil coincide con la búsqueda o los filtros." : "No hay perfiles comprados todavía."}</EmptyRow>
                    ) : (
                        filteredPerfiles.map((row) => (
                            <tr key={row.id} className={ROW_CLASS}>
                                <Td className="font-semibold whitespace-nowrap">{capitalizar(row.platform_nombre)}</Td>
                                {/* El correo es lo más largo: parte línea para que la tabla no scrollee en x. */}
                                <Td className="break-all">{row.cuenta_email}</Td>
                                <Td className="whitespace-nowrap">{capitalizar(row.nombre_perfil)}</Td>
                                <Td className="font-medium whitespace-nowrap" style={{ color: estadoColor[row.estado] }}>
                                    {estadoLabel[row.estado]}
                                </Td>
                                <Td className="whitespace-nowrap">{formatDateOnly(row.fecha_vencimiento)}</Td>
                                <ActionsCell>
                                    <IconAction icon={Eye} label={`Ver perfil ${capitalizar(row.nombre_perfil)} de ${capitalizar(row.platform_nombre)}`} title="Ver" onClick={() => openView(row)} />
                                    <IconAction icon={Pencil} label={`Editar perfil ${capitalizar(row.nombre_perfil)} de ${capitalizar(row.platform_nombre)}`} title="Editar" onClick={() => openEdit(row)} />
                                    <IconAction icon={Trash2} label={`Eliminar perfil ${capitalizar(row.nombre_perfil)} de ${capitalizar(row.platform_nombre)}`} title="Eliminar" tone="danger" onClick={() => openDelete(row.id)} />
                                </ActionsCell>
                            </tr>
                        ))
                    )}
                </tbody>
            </TableFrame>

            <MobileFrame toolbar={toolbar(true)}>
                {perfiles === undefined ? (
                    <SkeletonCards labels={COLUMNAS} actions={3} />
                ) : filteredPerfiles.length === 0 ? (
                    <MobileEmpty>{perfiles?.length ? "Ningún perfil coincide con la búsqueda o los filtros." : "No hay perfiles comprados todavía."}</MobileEmpty>
                ) : (
                    filteredPerfiles.map((row) => (
                        <MobileCard
                            key={row.id}
                            fields={[
                                { label: "Plataforma", value: capitalizar(row.platform_nombre) },
                                { label: "Correo", value: row.cuenta_email, className: "break-all" },
                                { label: "Perfil", value: capitalizar(row.nombre_perfil) },
                                { label: "Estado", value: estadoLabel[row.estado], className: "font-medium", style: { color: estadoColor[row.estado] } },
                                { label: "Vencimiento", value: formatDateOnly(row.fecha_vencimiento) },
                            ]}
                            actions={
                                <>
                                    <MobileAction icon={Eye} label="Ver" onClick={() => openView(row)} />
                                    <MobileAction icon={Pencil} label="Editar" onClick={() => openEdit(row)} />
                                    <MobileAction icon={Trash2} label="Eliminar" tone="danger" onClick={() => openDelete(row.id)} />
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
                            ["Plataforma", `${capitalizar(viewingRow.platform_nombre)} · ${accessTypeLabel[viewingRow.access_type]}`],
                            ["Perfil", capitalizar(viewingRow.nombre_perfil)],
                            ["PIN", viewingRow.pin ?? ""],
                            ["Correo", viewingRow.cuenta_email],
                            ["Contraseña", campoClave(viewingRow).value, campoClave(viewingRow).placeholder, campoClave(viewingRow).error],
                            ["Estado", estadoLabel[viewingRow.estado]],
                            ["Vencimiento", formatDateOnly(viewingRow.fecha_vencimiento)],
                        ].map(([label, value, placeholder = "--", error], i) => (
                            <div key={label} className="flex flex-col gap-1">
                                <label htmlFor={`ver-perfil-${i}`} className="text-xs text-secondary font-medium">{label}</label>
                                {/* La contraseña se ve oculta hasta pulsar "Mostrar"; copiar copia el valor real. */}
                                <CopyInput
                                    id={`ver-perfil-${i}`}
                                    className="bg-white/3"
                                    value={value ?? ""}
                                    placeholder={placeholder}
                                    readOnly
                                    secret={label === "Contraseña" && Boolean(value)}
                                    copyLabel={`Copiar ${label?.toLowerCase()}`}
                                    successLabel="Copiado"
                                    error={error}
                                />
                            </div>
                        ))}

                        <div className="flex items-center justify-end gap-2 mt-2">
                            <Button variant="ghost" onClick={() => setViewingId(null)}>Cerrar</Button>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal isOpen={editingId !== null} title="Editar perfil" onClose={cancelEdit} dismissible={!isPending}>
                {editingRow && (
                    <div className="flex flex-col gap-3">
                        {modalError && <Alert variant="error" message={modalError} />}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-secondary font-medium">Plataforma</label>
                            <Input className="bg-white/3 cursor-not-allowed opacity-60" value={`${capitalizar(editingRow.platform_nombre)} · ${accessTypeLabel[editingRow.access_type]}`} disabled />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label htmlFor="editar-perfil-correo" className="text-xs text-secondary font-medium">Correo</label>
                            <Input id="editar-perfil-correo" className="bg-white/3" type="email" autoComplete="off" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label htmlFor="editar-perfil-clave" className="text-xs text-secondary font-medium">Contraseña</label>
                            {/* Oculta por defecto, con botón para mostrarla. */}
                            <PasswordInput
                                id="editar-perfil-clave"
                                name="clave-perfil"
                                label=""
                                autoComplete="off"
                                value={editPassword ?? campoClave(editingRow).value}
                                placeholder={campoClave(editingRow).placeholder}
                                onChange={(e) => setEditPassword(e.target.value)}
                                error={editPassword === null ? campoClave(editingRow).error : undefined}
                            />
                        </div>
                        {/* Correo y contraseña propios de este perfil (app/lib/claves.ts): no tocan a los demás de la cuenta. */}
                        <p className="-mt-1 text-xs text-secondary">Mientras no los edites, el correo es el de la cuenta y la contraseña la del proveedor; al editarlos quedan solo para este perfil.</p>
                        <div className="flex flex-col gap-1">
                            <label htmlFor="editar-perfil-nombre" className="text-xs text-secondary font-medium">Nombre del perfil</label>
                            <Input id="editar-perfil-nombre" className="bg-white/3" value={editNombre} onChange={(e) => setEditNombre(e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label htmlFor="editar-perfil-pin" className="text-xs text-secondary font-medium">PIN</label>
                            <Input id="editar-perfil-pin" className="bg-white/3" inputMode="numeric" autoComplete="off" value={editPin} onChange={(e) => setEditPin(e.target.value.replace(/\D/g, ""))} placeholder="Sin PIN" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label htmlFor="editar-perfil-estado" className="text-xs text-secondary font-medium">Estado</label>
                            <SelectDropdown
                                id="editar-perfil-estado"
                                ariaLabel="Estado"
                                value={editEstado}
                                onChange={(value) => setEditEstado(value as PerfilRow["estado"])}
                                options={estadoOptions}
                            />
                            <p className="text-xs text-secondary">Solo los perfiles disponibles se muestran en la Tienda.</p>
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

            <Modal isOpen={deletingId !== null} title="Eliminar perfil" onClose={cancelDelete} dismissible={!isPending}>
                <div className="flex flex-col gap-3">
                    {modalError && <Alert variant="error" message={modalError} />}
                    <p className="text-sm text-white/90">
                        {(() => {
                            const row = perfiles?.find((r) => r.id === deletingId)
                            return row ? (
                                <>¿Eliminar el perfil <strong className="font-semibold text-white">{capitalizar(row.nombre_perfil)}</strong> de {capitalizar(row.platform_nombre)} ({row.cuenta_email})?</>
                            ) : "¿Eliminar este perfil?"
                        })()}{" "}
                        Dejará de estar disponible para la venta.
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
