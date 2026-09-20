"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Bell, CircleAlert, Search, Trash2, TriangleAlert, X } from "lucide-react"
import Alert from "@ui/alert"
import Input from "@ui/input"
import { getNotificacionesAction } from "@action/manager-and-admin/notificaciones/get-notificaciones-action"
import type { NotificacionRow } from "@action/manager-and-admin/notificaciones/get-notificaciones-action"
import { deleteNotificacionAction } from "@action/manager-and-admin/notificaciones/delete-notificacion-action"

type Tipo = NotificacionRow["tipo"]
type Origen = NotificacionRow["origen"]

// Mismos colores que @ui/alert: rojo = error, ámbar = advertencia.
const tipoStyle: Record<Tipo, { label: string; box: string; text: string; icon: ReactNode }> = {
    error: {
        label: "Error",
        box: "bg-red-500/10 border-red-500/20",
        text: "text-red-400",
        icon: <CircleAlert className="w-5 h-5 shrink-0" />,
    },
    advertencia: {
        label: "Advertencia",
        box: "bg-amber-500/10 border-amber-500/20",
        text: "text-amber-400",
        icon: <TriangleAlert className="w-5 h-5 shrink-0" />,
    },
}

const origenLabel: Record<Origen, string> = { scraping: "Scraping", plataforma: "Plataforma" }

// sin tildes ni mayúsculas: buscar "catalogo" encuentra "catálogo"
const plano = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" })

function hace(iso: string) {
    const min = Math.round((new Date(iso).getTime() - Date.now()) / 60_000)
    if (min > -1) return "ahora"
    if (min > -60) return rtf.format(min, "minute")
    const h = Math.round(min / 60)
    if (h > -24) return rtf.format(h, "hour")
    return rtf.format(Math.round(h / 24), "day")
}

/** Estado de la bandeja. `enabled` = solo admin/manager (los demás roles no ven nada por RLS). */
export function useNotificaciones(enabled: boolean) {
    const [items, setItems] = useState<NotificacionRow[]>([])
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        if (!enabled) return
        let active = true
        getNotificacionesAction().then((rows) => {
            if (active && rows) setItems(rows)
        })
        return () => {
            active = false
        }
    }, [enabled])

    // el cron trae avisos con la página ya abierta: se vuelve a leer al abrir
    const open = () => {
        setIsOpen(true)
        getNotificacionesAction().then((rows) => {
            if (rows) setItems(rows)
        })
    }
    const close = useCallback(() => setIsOpen(false), [])

    const remove = async (id: number) => {
        const error = await deleteNotificacionAction({ id })
        if (!error) setItems((prev) => prev.filter((n) => n.id !== id))
        return error
    }

    return { items, isOpen, open, close, remove }
}

export function NotificacionesBell({ count, onClick }: { count: number; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="relative p-2 rounded-xl hover:bg-white/5 transition-colors"
            aria-label={count > 0 ? `Notificaciones (${count})` : "Notificaciones"}
        >
            <Bell className="w-5 h-5 text-secondary" />
            {count > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full bg-accent text-[10px] leading-4 font-semibold text-white text-center">
                    {count > 99 ? "99+" : count}
                </span>
            )}
        </button>
    )
}

function FilterRow<T extends string>({
    label,
    value,
    options,
    onChange,
}: {
    label: string
    value: T | ""
    options: { value: T; label: string }[]
    onChange: (value: T | "") => void
}) {
    const all: { value: T | ""; label: string }[] = [{ value: "", label: "Todos" }, ...options]
    return (
        <div className="flex items-start gap-2">
            <span className="w-12 shrink-0 pt-1 text-xs text-secondary">{label}</span>
            <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
                {all.map((o) => (
                    <button
                        key={o.value}
                        type="button"
                        aria-pressed={value === o.value}
                        onClick={() => onChange(o.value)}
                        className={`px-3 py-1 rounded-full text-xs border transition-colors ${value === o.value
                            ? "bg-accent/10 border-accent/30 text-accent"
                            : "border-white/10 text-secondary hover:text-white hover:bg-white/5"
                            }`}
                    >
                        {o.label}
                    </button>
                ))}
            </div>
        </div>
    )
}

interface DrawerProps {
    open: boolean
    items: NotificacionRow[]
    onClose: () => void
    /** Devuelve el mensaje de error, o null si se eliminó. */
    onDelete: (id: number) => Promise<string | null>
}

export default function NotificacionesDrawer({ open, items, onClose, onDelete }: DrawerProps) {
    const [search, setSearch] = useState("")
    const [tipo, setTipo] = useState<Tipo | "">("")
    const [origen, setOrigen] = useState<Origen | "">("")
    const [deletingId, setDeletingId] = useState<number | null>(null)
    const [error, setError] = useState<string | null>(null)
    const searchRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (!open) return
        const previo = document.activeElement as HTMLElement | null
        searchRef.current?.focus({ preventScroll: true })
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose()
        }
        document.addEventListener("keydown", onKey)
        document.body.style.overflow = "hidden"
        return () => {
            document.removeEventListener("keydown", onKey)
            document.body.style.overflow = ""
            previo?.focus()
        }
    }, [open, onClose])

    const term = plano(search.trim())
    const visibles = useMemo(
        () =>
            items.filter(
                (n) =>
                    (!tipo || n.tipo === tipo) &&
                    (!origen || n.origen === origen) &&
                    (!term || plano(n.titulo).includes(term) || plano(n.mensaje).includes(term)),
            ),
        [items, tipo, origen, term],
    )

    const eliminar = async (id: number) => {
        setDeletingId(id)
        setError(null)
        const err = await onDelete(id)
        setDeletingId(null)
        if (err) setError(err)
    }

    return (
        // siempre montado para animar la salida; `inert` lo saca del foco, del teclado y de los clics mientras está cerrado
        <div inert={!open} className="fixed inset-0 z-[60] overflow-hidden">
            <div
                aria-hidden="true"
                onClick={onClose}
                className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none ${open ? "opacity-100" : "opacity-0"}`}
            />
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Notificaciones"
                className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-background border-l border-white/6 shadow-2xl transition-transform duration-300 ease-in-out motion-reduce:transition-none ${open ? "translate-x-0" : "translate-x-full"}`}
            >
                <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/6 px-4">
                    <h2 className="text-lg font-semibold">
                        Notificaciones
                        {items.length > 0 && <span className="ml-2 text-xs font-normal text-secondary">{items.length}</span>}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="-mr-2 p-2 rounded-xl hover:bg-white/5 transition-colors"
                        aria-label="Cerrar notificaciones"
                    >
                        <X className="w-5 h-5 text-secondary" />
                    </button>
                </header>

                <div className="flex shrink-0 flex-col gap-3 border-b border-white/6 p-4">
                    <Input
                        ref={searchRef}
                        placeholder="Buscar por nombre..."
                        aria-label="Buscar notificaciones"
                        leftIcon={<Search className="w-4 h-4" />}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <FilterRow
                        label="Tipo"
                        value={tipo}
                        onChange={setTipo}
                        options={[
                            { value: "error", label: "Errores" },
                            { value: "advertencia", label: "Advertencias" },
                        ]}
                    />
                    <FilterRow
                        label="Origen"
                        value={origen}
                        onChange={setOrigen}
                        options={[
                            { value: "scraping", label: "Scraping" },
                            { value: "plataforma", label: "Plataforma" },
                        ]}
                    />
                </div>

                {/* fuera del área con scroll: si la lista está scrolleada el error no puede quedar fuera de vista */}
                {error && (
                    <div className="shrink-0 px-4 pt-4">
                        <Alert variant="error" message={error} onDismiss={() => setError(null)} />
                    </div>
                )}

                <div className="flex-1 overflow-y-auto overscroll-contain p-4">
                    {visibles.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-12 text-center text-secondary">
                            <Bell className="w-8 h-8 text-muted" />
                            <p className="text-sm">
                                {items.length === 0 ? "No hay notificaciones." : "Ninguna notificación coincide con el filtro."}
                            </p>
                        </div>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {visibles.map((n) => {
                                const s = tipoStyle[n.tipo]
                                return (
                                    <li key={n.id} className={`rounded-xl border p-3 ${s.box}`}>
                                        <div className="flex items-start gap-3">
                                            <span className={s.text}>{s.icon}</span>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-white">{n.titulo}</p>
                                                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-white/70">{n.mensaje}</p>
                                                <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-xs text-secondary">
                                                    <span className={`font-medium ${s.text}`}>{s.label}</span>
                                                    <span aria-hidden="true">·</span>
                                                    <span>{origenLabel[n.origen]}</span>
                                                    <span aria-hidden="true">·</span>
                                                    <time dateTime={n.created_at} title={new Date(n.created_at).toLocaleString("es-CO")}>
                                                        {hace(n.created_at)}
                                                    </time>
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => eliminar(n.id)}
                                                disabled={deletingId === n.id}
                                                className="shrink-0 p-1.5 rounded-lg text-secondary transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                                                aria-label={`Eliminar notificación: ${n.titulo}`}
                                                title="Eliminar"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    )
}
