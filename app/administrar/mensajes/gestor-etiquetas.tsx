"use client"

import { useId, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Pencil, Plus, Trash2 } from "lucide-react"
import Modal from "@ui/modal"
import Input from "@ui/input"
import Button from "@ui/button"
import Alert from "@ui/alert"
import { COLORES_ETIQUETA, ETIQUETA_MAX, ETIQUETA_NOMBRE_MAX, etiquetaSchema, firstError, largo, normalizarNombre, type ColorEtiqueta } from "@lib/chat-bandeja"
import type { Etiqueta } from "@action/manager-and-admin/mensajes/mensajes-action"
import { eliminarEtiquetaAction, guardarEtiquetaAction } from "@action/manager-and-admin/mensajes/etiquetas-action"
import { useBandeja } from "@/app/administrar/mensajes/bandeja-contexto"
import { BotonIcono, ConfirmarFila, Contador, enfocarBoton, Limite } from "@/app/administrar/mensajes/gestor-comun"

/** Paleta de colores como grupo de radio: ←/→ cambian el color, solo el elegido entra en el Tab. */
function PaletaColores({ valor, onCambio, deshabilitado }: Readonly<{ valor: ColorEtiqueta; onCambio: (c: ColorEtiqueta) => void; deshabilitado?: boolean }>) {
    const ref = useRef<HTMLDivElement>(null)
    const etiquetaId = useId()
    const onKeyDown = (e: React.KeyboardEvent) => {
        const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0
        if (!delta) return
        e.preventDefault()
        const n = COLORES_ETIQUETA.length
        const j = (COLORES_ETIQUETA.findIndex((c) => c.color === valor) + delta + n) % n
        onCambio(COLORES_ETIQUETA[j].color)
        ref.current?.querySelectorAll<HTMLElement>('[role="radio"]')[j]?.focus()
    }
    return (
        <div className="flex flex-col gap-1.5">
            <span id={etiquetaId} className="text-sm font-medium text-secondary">Color</span>
            <div ref={ref} role="radiogroup" aria-labelledby={etiquetaId} onKeyDown={onKeyDown} className="flex flex-wrap gap-1.5">
                {COLORES_ETIQUETA.map((c) => {
                    const activo = c.color === valor
                    return (
                        <button
                            key={c.color}
                            type="button"
                            role="radio"
                            aria-checked={activo}
                            aria-label={c.nombre}
                            title={c.nombre}
                            tabIndex={activo ? 0 : -1}
                            disabled={deshabilitado}
                            onClick={() => onCambio(c.color)}
                            className={`grid h-8 w-8 place-items-center rounded-full ring-offset-2 ring-offset-[#12121a] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-50 ${activo ? "ring-2 ring-white/80" : "motion-safe:hover:scale-110"}`}
                            style={{ background: c.color }}
                        >
                            {activo && <Check className="h-4 w-4 text-white drop-shadow" strokeWidth={3} aria-hidden="true" />}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

interface FormProps {
    etiqueta?: Etiqueta
    existentes: Etiqueta[]
    onListo: () => void
    onCancelar?: () => void
}

/** Crear (sin etiqueta) o editar. Valida igual que la base antes de mandar: nombre 1–30 sin repetir, color de la paleta. */
function FormEtiqueta({ etiqueta, existentes, onListo, onCancelar }: Readonly<FormProps>) {
    const router = useRouter()
    const libre = COLORES_ETIQUETA.find((c) => !existentes.some((e) => e.color === c.color))?.color ?? COLORES_ETIQUETA[0].color
    const [nombre, setNombre] = useState(etiqueta?.nombre ?? "")
    const [color, setColor] = useState<ColorEtiqueta>(etiqueta?.color ?? libre)
    const [intentado, setIntentado] = useState(false)
    const [guardando, setGuardando] = useState(false)
    const [errorServidor, setErrorServidor] = useState<string | null>(null)

    const n = largo(normalizarNombre(nombre))
    const repetido = existentes.some((e) => e.id !== etiqueta?.id && e.nombre.toLowerCase() === normalizarNombre(nombre).toLowerCase())
    // Errores en vivo: largo y repetido mientras escribe; "vacío" solo después de intentar guardar.
    const errorNombre =
        n > ETIQUETA_NOMBRE_MAX ? `El nombre de la etiqueta es muy largo (máximo ${ETIQUETA_NOMBRE_MAX} caracteres).` : repetido ? "Ya existe una etiqueta con ese nombre." : intentado && n === 0 ? "Escribe el nombre de la etiqueta." : undefined

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault()
        setIntentado(true)
        setErrorServidor(null)
        const p = etiquetaSchema.safeParse({ id: etiqueta?.id ?? null, nombre, color })
        if (!p.success) {
            setErrorServidor(p.error.issues[0]?.path[0] === "color" ? firstError(p.error) : null)
            return
        }
        if (repetido) return
        setGuardando(true)
        const r = await guardarEtiquetaAction({ id: p.data.id, nombre: p.data.nombre, color: p.data.color }).catch(() => ({ ok: false as const, error: "No se pudo guardar la etiqueta. Inténtalo de nuevo." }))
        setGuardando(false)
        if (!r.ok) {
            setErrorServidor(r.error)
            return
        }
        router.refresh()
        if (!etiqueta) {
            setNombre("")
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
            className={`flex flex-col gap-3 ${etiqueta ? "rounded-xl border border-white/10 bg-white/3 p-3" : ""}`}
        >
            <div className="relative">
                <Input
                    label={etiqueta ? "Nombre" : "Nueva etiqueta"}
                    placeholder="Ej.: Cliente VIP"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    error={errorNombre}
                    disabled={guardando}
                    autoFocus={Boolean(etiqueta)}
                    autoComplete="off"
                />
                <span className="absolute top-0.5 right-0">
                    <Contador n={n} max={ETIQUETA_NOMBRE_MAX} />
                </span>
            </div>
            <PaletaColores valor={color} onCambio={setColor} deshabilitado={guardando} />
            {errorServidor && <Alert variant="error" message={errorServidor} onDismiss={() => setErrorServidor(null)} />}
            <div className="flex justify-end gap-2">
                {onCancelar && (
                    <Button variant="ghost" size="sm" onClick={onCancelar} disabled={guardando}>
                        Cancelar
                    </Button>
                )}
                <Button type="submit" size="sm" isLoading={guardando} disabled={Boolean(errorNombre)} leftIcon={etiqueta ? undefined : <Plus className="h-3.5 w-3.5" />}>
                    {etiqueta ? "Guardar cambios" : "Crear etiqueta"}
                </Button>
            </div>
        </form>
    )
}

/** Etiquetas de la bandeja (compartidas por todo el staff): crear, editar y borrar. */
export default function GestorEtiquetas({ abierto, onCerrar }: Readonly<{ abierto: boolean; onCerrar: () => void }>) {
    const router = useRouter()
    const { etiquetas, conversaciones } = useBandeja()
    const [editando, setEditando] = useState<number | null>(null)
    const [borrando, setBorrando] = useState<number | null>(null)
    const [ocupado, setOcupado] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const enUso = (id: number) => conversaciones.filter((c) => c.etiquetas.includes(id)).length
    const lleno = etiquetas.length >= ETIQUETA_MAX

    const eliminar = async (id: number) => {
        setOcupado(true)
        setError(null)
        const r = await eliminarEtiquetaAction(id).catch(() => ({ ok: false as const, error: "No se pudo borrar la etiqueta. Inténtalo de nuevo." }))
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
        setError(null)
        onCerrar()
    }

    return (
        <Modal isOpen={abierto} title="Etiquetas" onClose={cerrar} dismissible={!ocupado}>
            <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-secondary">Las ve todo el equipo. Un chat puede tener varias; filtra la lista por ellas.</p>
                    <Limite n={etiquetas.length} max={ETIQUETA_MAX} que="etiquetas" />
                </div>

                {lleno ? (
                    <Alert variant="warning" message={`Llegaste al máximo de ${ETIQUETA_MAX} etiquetas. Borra una para crear otra.`} />
                ) : (
                    <FormEtiqueta existentes={etiquetas} onListo={() => {}} />
                )}

                {error && <Alert variant="error" message={error} onDismiss={() => setError(null)} />}

                <ul className="flex flex-col gap-1.5 border-t border-white/8 pt-4" aria-label="Etiquetas creadas">
                    {etiquetas.length === 0 && <li className="py-4 text-center text-sm text-secondary">Aún no hay etiquetas. Crea la primera arriba.</li>}
                    {etiquetas.map((e) => {
                        const n = enUso(e.id)
                        if (editando === e.id)
                            return (
                                <li key={e.id}>
                                    <FormEtiqueta etiqueta={e} existentes={etiquetas} onListo={() => setEditando(null)} onCancelar={() => { setEditando(null); enfocarBoton(`Editar ${e.nombre}`) }} />
                                </li>
                            )
                        if (borrando === e.id)
                            return (
                                <li key={e.id}>
                                    <ConfirmarFila
                                        titulo={`¿Eliminar «${e.nombre}»?`}
                                        detalle={n > 0 ? `Se quita de ${n} ${n === 1 ? "chat" : "chats"}.` : "Ningún chat la tiene."}
                                        cargando={ocupado}
                                        onConfirmar={() => eliminar(e.id)}
                                        onCancelar={() => {
                                            setBorrando(null)
                                            enfocarBoton(`Eliminar ${e.nombre}`)
                                        }}
                                    />
                                </li>
                            )
                        return (
                            <li key={e.id} className="flex items-center gap-3 rounded-xl px-2 py-1 hover:bg-white/3">
                                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: e.color }} aria-hidden="true" />
                                <span className="min-w-0 flex-1 truncate text-sm text-white">{e.nombre}</span>
                                <span className="shrink-0 text-xs tabular-nums text-secondary">{n} {n === 1 ? "chat" : "chats"}</span>
                                <BotonIcono etiqueta={`Editar ${e.nombre}`} onClick={() => { setBorrando(null); setEditando(e.id) }} disabled={ocupado}>
                                    <Pencil className="h-4 w-4" aria-hidden="true" />
                                </BotonIcono>
                                <BotonIcono etiqueta={`Eliminar ${e.nombre}`} peligro onClick={() => { setEditando(null); setBorrando(e.id) }} disabled={ocupado}>
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </BotonIcono>
                            </li>
                        )
                    })}
                </ul>
            </div>
        </Modal>
    )
}
