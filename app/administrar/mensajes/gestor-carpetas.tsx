"use client"

import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Check, ChevronDown, ChevronUp, Folder, ListChecks, Pencil, Plus, Trash2 } from "lucide-react"
import Modal from "@ui/modal"
import Input from "@ui/input"
import Button from "@ui/button"
import Alert from "@ui/alert"
import { SearchInput } from "@ui/data-frame"
import { CARPETA_CHATS_MAX, CARPETA_ICONO_MAX, CARPETA_MAX, CARPETA_NOMBRE_MAX, carpetaSchema, firstError, largo, normalizarIcono, normalizarNombre } from "@lib/chat-bandeja"
import { quitarTildes } from "@lib/text"
import type { Carpeta } from "@action/manager-and-admin/mensajes/mensajes-action"
import { carpetaChatsAction, eliminarCarpetaAction, guardarCarpetaAction, ordenarCarpetasAction } from "@action/manager-and-admin/mensajes/carpetas-action"
import { useBandeja } from "@/app/administrar/mensajes/bandeja-contexto"
import { BotonIcono, ConfirmarFila, Contador, enfocarBoton, Limite } from "@/app/administrar/mensajes/gestor-comun"
import { inicialDe, nombreDe, textoBusqueda } from "@/app/administrar/mensajes/bandeja-util"

const FALLA = (que: string) => ({ ok: false as const, error: `No se pudo ${que}. Inténtalo de nuevo.` })

interface FormProps {
    carpeta?: Carpeta
    existentes: Carpeta[]
    onListo: () => void
    onCancelar?: () => void
}

/** Crear (sin carpeta) o editar: nombre 1–24 sin repetir, icono opcional (un emoji, ≤8 caracteres). */
function FormCarpeta({ carpeta, existentes, onListo, onCancelar }: Readonly<FormProps>) {
    const router = useRouter()
    const [nombre, setNombre] = useState(carpeta?.nombre ?? "")
    const [icono, setIcono] = useState(carpeta?.icono ?? "")
    const [intentado, setIntentado] = useState(false)
    const [guardando, setGuardando] = useState(false)
    const [errorServidor, setErrorServidor] = useState<string | null>(null)

    const n = largo(normalizarNombre(nombre))
    const nIcono = largo(normalizarIcono(icono) ?? "")
    const repetida = existentes.some((c) => c.id !== carpeta?.id && c.nombre.toLowerCase() === normalizarNombre(nombre).toLowerCase())
    const errorNombre =
        n > CARPETA_NOMBRE_MAX ? `El nombre de la carpeta es muy largo (máximo ${CARPETA_NOMBRE_MAX} caracteres).` : repetida ? "Ya existe una carpeta con ese nombre." : intentado && n === 0 ? "Escribe el nombre de la carpeta." : undefined
    const errorIcono = nIcono > CARPETA_ICONO_MAX ? "El icono no es válido." : undefined

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault()
        setIntentado(true)
        setErrorServidor(null)
        const p = carpetaSchema.safeParse({ id: carpeta?.id ?? null, nombre, icono })
        if (!p.success || repetida) {
            if (!p.success && !errorNombre && !errorIcono && n > 0) setErrorServidor(firstError(p.error))
            return
        }
        setGuardando(true)
        const r = await guardarCarpetaAction({ id: p.data.id, nombre: p.data.nombre, icono: p.data.icono }).catch(() => FALLA("guardar la carpeta"))
        setGuardando(false)
        if (!r.ok) {
            setErrorServidor(r.error)
            return
        }
        router.refresh()
        if (!carpeta) {
            setNombre("")
            setIcono("")
            setIntentado(false)
        }
        onListo()
    }

    return (
        <form
            onSubmit={guardar}
            noValidate
            onKeyDown={(e) => {
                if (e.key === "Escape" && onCancelar && !guardando) {
                    e.preventDefault()
                    onCancelar()
                }
            }}
            className={`flex flex-col gap-2 ${carpeta ? "rounded-xl border border-white/10 bg-white/3 p-3" : ""}`}
        >
            <div className="flex items-start gap-2">
                <div className="w-20 shrink-0">
                    <Input label="Icono" placeholder="📁" value={icono} onChange={(e) => setIcono(e.target.value)} error={errorIcono} disabled={guardando} autoComplete="off" className="text-center" />
                </div>
                <div className="relative min-w-0 flex-1">
                    <Input
                        label={carpeta ? "Nombre" : "Nueva carpeta"}
                        placeholder="Ej.: Renovaciones"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        error={errorNombre}
                        disabled={guardando}
                        autoFocus={Boolean(carpeta)}
                        autoComplete="off"
                    />
                    <span className="absolute top-0.5 right-0">
                        <Contador n={n} max={CARPETA_NOMBRE_MAX} />
                    </span>
                </div>
            </div>
            {errorServidor && <Alert variant="error" message={errorServidor} onDismiss={() => setErrorServidor(null)} />}
            <div className="flex justify-end gap-2">
                {onCancelar && (
                    <Button variant="ghost" size="sm" onClick={onCancelar} disabled={guardando}>
                        Cancelar
                    </Button>
                )}
                <Button type="submit" size="sm" isLoading={guardando} disabled={Boolean(errorNombre || errorIcono)} leftIcon={carpeta ? undefined : <Plus className="h-3.5 w-3.5" />}>
                    {carpeta ? "Guardar cambios" : "Crear carpeta"}
                </Button>
            </div>
        </form>
    )
}

/** Elegir los chats de una carpeta (≤100): casillas con buscador; se guarda el conjunto exacto. */
function ElegirChats({ carpeta, onVolver }: Readonly<{ carpeta: Carpeta; onVolver: () => void }>) {
    const router = useRouter()
    const { conversaciones } = useBandeja()
    const inicial = useMemo(() => conversaciones.filter((c) => c.carpetas.includes(carpeta.id)).map((c) => c.cliente_id), [conversaciones, carpeta.id])
    const [elegidos, setElegidos] = useState<string[]>(inicial)
    const [busqueda, setBusqueda] = useState("")
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const raiz = useRef<HTMLDivElement>(null)
    const lleno = elegidos.length >= CARPETA_CHATS_MAX
    // El botón que abrió esta vista ya no está: el foco pasa al buscador (y Esc vuelve a la lista sin cerrar el modal).
    useEffect(() => {
        raiz.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true })
    }, [])
    const cambio = elegidos.length !== inicial.length || elegidos.some((id) => !inicial.includes(id))

    // Los que ya están, arriba; después por nombre. El orden no cambia al marcar (no salta la lista).
    const lista = useMemo(() => {
        const q = quitarTildes(busqueda.trim())
        return conversaciones
            .filter((c) => !q || textoBusqueda(c).includes(q))
            .sort((a, b) => Number(inicial.includes(b.cliente_id)) - Number(inicial.includes(a.cliente_id)) || nombreDe(a.cliente).localeCompare(nombreDe(b.cliente), "es"))
    }, [conversaciones, busqueda, inicial])

    const guardar = async () => {
        setGuardando(true)
        setError(null)
        const r = await carpetaChatsAction(carpeta.id, elegidos).catch(() => FALLA("guardar los chats de la carpeta"))
        setGuardando(false)
        if (!r.ok) {
            setError(r.error)
            return
        }
        router.refresh()
        onVolver()
    }

    return (
        <div
            ref={raiz}
            className="flex flex-col gap-3"
            onKeyDown={(e) => {
                if (e.key === "Escape" && !guardando) {
                    e.preventDefault()
                    onVolver()
                }
            }}
        >
            <div className="flex items-center justify-between gap-2">
                <Button variant="ghost" size="sm" onClick={onVolver} disabled={guardando} leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}>
                    Carpetas
                </Button>
                <Limite n={elegidos.length} max={CARPETA_CHATS_MAX} que="chats" />
            </div>
            <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por nombre o correo..." className="w-full" />
            <ul className="flex max-h-[min(22rem,50dvh)] flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-xl border border-white/8 p-1 [scrollbar-width:thin]" aria-label={`Chats de ${carpeta.nombre}`}>
                {lista.length === 0 && <li className="py-6 text-center text-sm text-secondary">{busqueda ? "Ningún chat coincide." : "Aún no hay chats."}</li>}
                {lista.map((c) => {
                    const marcado = elegidos.includes(c.cliente_id)
                    const bloqueado = !marcado && lleno
                    return (
                        <li key={c.cliente_id}>
                            <button
                                type="button"
                                role="checkbox"
                                aria-checked={marcado}
                                disabled={bloqueado || guardando}
                                title={bloqueado ? `Máximo ${CARPETA_CHATS_MAX} chats por carpeta.` : undefined}
                                onClick={() => setElegidos((xs) => (marcado ? xs.filter((x) => x !== c.cliente_id) : [...xs, c.cliente_id]))}
                                className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                                <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${marcado ? "border-accent bg-accent" : "border-white/20 bg-white/3"}`} aria-hidden="true">
                                    {marcado && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                                </span>
                                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/8 text-xs font-semibold text-white/75" aria-hidden="true">
                                    {inicialDe(nombreDe(c.cliente))}
                                </span>
                                <span className="flex min-w-0 flex-col">
                                    <span className="truncate text-sm text-white">{nombreDe(c.cliente)}</span>
                                    {c.cliente?.email && c.cliente.username && <span className="truncate text-xs text-secondary">{c.cliente.email}</span>}
                                </span>
                            </button>
                        </li>
                    )
                })}
            </ul>
            {lleno && <p className="text-xs text-amber-300">La carpeta llegó a {CARPETA_CHATS_MAX} chats: quita uno para agregar otro.</p>}
            {error && <Alert variant="error" message={error} onDismiss={() => setError(null)} />}
            <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={onVolver} disabled={guardando}>
                    Cancelar
                </Button>
                <Button size="sm" onClick={guardar} isLoading={guardando} disabled={!cambio}>
                    Guardar chats
                </Button>
            </div>
        </div>
    )
}

/** Carpetas de la bandeja (compartidas por todo el staff, pestañas de la lista): crear, renombrar, ordenar, borrar y elegir sus chats. */
export default function GestorCarpetas({ abierto, onCerrar }: Readonly<{ abierto: boolean; onCerrar: () => void }>) {
    const router = useRouter()
    const { carpetas } = useBandeja()
    const [editando, setEditando] = useState<number | null>(null)
    const [borrando, setBorrando] = useState<number | null>(null)
    const [eligiendo, setEligiendo] = useState<number | null>(null)
    const [ocupado, setOcupado] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [, startTransition] = useTransition()
    const [lista, mover] = useOptimistic(carpetas, (cs: Carpeta[], ids: number[]) => ids.flatMap((id) => cs.filter((c) => c.id === id)))
    const lleno = carpetas.length >= CARPETA_MAX
    const carpetaEligiendo = carpetas.find((c) => c.id === eligiendo)

    const reordenar = (i: number, delta: -1 | 1) => {
        const ids = lista.map((c) => c.id)
        const otro = ids[i + delta]
        ids[i + delta] = ids[i]
        ids[i] = otro
        setError(null)
        startTransition(async () => {
            mover(ids)
            const r = await ordenarCarpetasAction(ids).catch(() => FALLA("ordenar las carpetas"))
            if (!r.ok) setError(r.error)
            else router.refresh()
        })
    }

    const eliminar = async (id: number) => {
        setOcupado(true)
        setError(null)
        const r = await eliminarCarpetaAction(id).catch(() => FALLA("borrar la carpeta"))
        setOcupado(false)
        if (!r.ok) {
            setError(r.error)
            return
        }
        setBorrando(null)
        router.refresh()
    }

    const cerrar = () => {
        setEditando(null)
        setBorrando(null)
        setEligiendo(null)
        setError(null)
        onCerrar()
    }

    return (
        <Modal isOpen={abierto} title={carpetaEligiendo ? `Chats de «${carpetaEligiendo.nombre}»` : "Carpetas"} onClose={cerrar} dismissible={!ocupado}>
            {carpetaEligiendo ? (
                <ElegirChats key={carpetaEligiendo.id} carpeta={carpetaEligiendo} onVolver={() => setEligiendo(null)} />
            ) : (
                <div className="flex flex-col gap-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-secondary">Cada carpeta es una pestaña de la lista. Las ve todo el equipo; un chat puede estar en varias.</p>
                        <Limite n={carpetas.length} max={CARPETA_MAX} que="carpetas" />
                    </div>

                    {lleno ? (
                        <Alert variant="warning" message={`Llegaste al máximo de ${CARPETA_MAX} carpetas. Borra una para crear otra.`} />
                    ) : (
                        <FormCarpeta existentes={carpetas} onListo={() => {}} />
                    )}

                    {error && <Alert variant="error" message={error} onDismiss={() => setError(null)} />}

                    <ol className="flex flex-col gap-1.5 border-t border-white/8 pt-4" aria-label="Carpetas, en el orden de las pestañas">
                        {lista.length === 0 && <li className="py-4 text-center text-sm text-secondary">Aún no hay carpetas. Crea la primera arriba.</li>}
                        {lista.map((c, i) => {
                            if (editando === c.id)
                                return (
                                    <li key={c.id}>
                                        <FormCarpeta carpeta={c} existentes={carpetas} onListo={() => setEditando(null)} onCancelar={() => { setEditando(null); enfocarBoton(`Editar ${c.nombre}`) }} />
                                    </li>
                                )
                            if (borrando === c.id)
                                return (
                                    <li key={c.id}>
                                        <ConfirmarFila titulo={`¿Eliminar «${c.nombre}»?`} detalle="Los chats no se borran: solo salen de esta carpeta." cargando={ocupado} onConfirmar={() => eliminar(c.id)} onCancelar={() => {
                                            setBorrando(null)
                                            enfocarBoton(`Eliminar ${c.nombre}`)
                                        }} />
                                    </li>
                                )
                            return (
                                <li key={c.id} className="flex items-center gap-1 rounded-xl py-1 pr-1 pl-0.5 hover:bg-white/3">
                                    <span className="flex shrink-0">
                                        <BotonIcono etiqueta={`Subir ${c.nombre}`} className="h-8 w-7 rounded-md" disabled={i === 0 || ocupado} onClick={() => reordenar(i, -1)}>
                                            <ChevronUp className="h-4 w-4" aria-hidden="true" />
                                        </BotonIcono>
                                        <BotonIcono etiqueta={`Bajar ${c.nombre}`} className="h-8 w-7 rounded-md" disabled={i === lista.length - 1 || ocupado} onClick={() => reordenar(i, 1)}>
                                            <ChevronDown className="h-4 w-4" aria-hidden="true" />
                                        </BotonIcono>
                                    </span>
                                    <span className="grid w-7 shrink-0 place-items-center text-base leading-none" aria-hidden="true">
                                        {c.icono ?? <Folder className="h-4 w-4 text-secondary" />}
                                    </span>
                                    <span className="flex min-w-0 flex-1 flex-col pl-1">
                                        <span className="truncate text-sm text-white">{c.nombre}</span>
                                        <span className={`text-xs tabular-nums ${c.chats >= CARPETA_CHATS_MAX ? "text-amber-300" : "text-secondary"}`}>
                                            {c.chats} de {CARPETA_CHATS_MAX} chats
                                        </span>
                                    </span>
                                    <BotonIcono etiqueta={`Elegir chats de ${c.nombre}`} onClick={() => setEligiendo(c.id)} disabled={ocupado}>
                                        <ListChecks className="h-4 w-4" aria-hidden="true" />
                                    </BotonIcono>
                                    <BotonIcono etiqueta={`Editar ${c.nombre}`} onClick={() => { setBorrando(null); setEditando(c.id) }} disabled={ocupado}>
                                        <Pencil className="h-4 w-4" aria-hidden="true" />
                                    </BotonIcono>
                                    <BotonIcono etiqueta={`Eliminar ${c.nombre}`} peligro onClick={() => { setEditando(null); setBorrando(c.id) }} disabled={ocupado}>
                                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                                    </BotonIcono>
                                </li>
                            )
                        })}
                    </ol>
                </div>
            )}
        </Modal>
    )
}
