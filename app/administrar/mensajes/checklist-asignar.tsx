"use client"

import { useState, type ReactNode } from "react"
import { Check, Folder } from "lucide-react"
import Button from "@ui/button"
import { CARPETA_CHATS_MAX } from "@lib/chat-bandeja"
import type { Carpeta, Etiqueta } from "@action/manager-and-admin/mensajes/mensajes-action"

export interface OpcionChecklist {
    id: number
    nombre: string
    /** Punto de color (etiquetas). */
    color?: string
    /** Emoji de la carpeta. */
    icono?: string | null
    /** Por qué no se puede marcar (p. ej. carpeta llena); si ya está marcada, se puede desmarcar igual. */
    bloqueo?: string | null
}

interface ChecklistProps {
    titulo: string
    opciones: OpcionChecklist[]
    inicial: number[]
    /** Devuelve el error (o null): con error la lista queda abierta para reintentar. */
    onAplicar: (ids: number[]) => Promise<string | null> | void
    onCancelar: () => void
    /** Después de aplicar bien (por defecto, onCancelar). */
    onListo?: () => void
    /** Sin opciones (todavía no hay etiquetas/carpetas). */
    vacio: ReactNode
}

export const opcionesEtiquetas = (etiquetas: Etiqueta[]): OpcionChecklist[] => etiquetas.map((e) => ({ id: e.id, nombre: e.nombre, color: e.color }))

/** Una carpeta llena (100 chats) no acepta más; si el chat ya está en ella, se puede sacar. */
export const opcionesCarpetas = (carpetas: Carpeta[]): OpcionChecklist[] =>
    carpetas.map((c) => ({ id: c.id, nombre: c.nombre, icono: c.icono, bloqueo: c.chats >= CARPETA_CHATS_MAX ? `Llena (${CARPETA_CHATS_MAX})` : null }))

/** Lista de casillas para elegir las etiquetas o carpetas de un chat; se guarda el conjunto exacto con "Aplicar". */
export default function ChecklistAsignar({ titulo, opciones, inicial, onAplicar, onCancelar, onListo, vacio }: Readonly<ChecklistProps>) {
    const [elegidas, setElegidas] = useState<number[]>(inicial)
    const [guardando, setGuardando] = useState(false)
    const cambio = elegidas.length !== inicial.length || elegidas.some((id) => !inicial.includes(id))

    const alternar = (id: number) => setElegidas((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]))
    const aplicar = async () => {
        setGuardando(true)
        // Se manda en el orden de la lista (estable); la base guarda el conjunto.
        const error = await onAplicar(opciones.map((o) => o.id).filter((id) => elegidas.includes(id)))
        setGuardando(false)
        if (!error) (onListo ?? onCancelar)()
    }

    return (
        <div className="flex flex-col gap-1" role="group" aria-label={titulo}>
            <p className="px-2.5 pt-1 pb-1.5 text-xs font-semibold tracking-wide text-secondary uppercase">{titulo}</p>
            {opciones.length === 0 ? (
                <div className="px-2.5 pb-2 text-sm text-secondary">{vacio}</div>
            ) : (
                <ul className="flex max-h-64 flex-col gap-0.5 overflow-y-auto overscroll-contain [scrollbar-width:thin]">
                    {opciones.map((o) => {
                        const marcada = elegidas.includes(o.id)
                        const bloqueada = !marcada && Boolean(o.bloqueo)
                        return (
                            <li key={o.id}>
                                <button
                                    type="button"
                                    role="checkbox"
                                    aria-checked={marcada}
                                    disabled={bloqueada || guardando}
                                    title={bloqueada ? (o.bloqueo ?? undefined) : undefined}
                                    onClick={() => alternar(o.id)}
                                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-white/90 hover:bg-white/8 focus-visible:bg-white/8 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
                                >
                                    <span
                                        className={`grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors ${marcada ? "border-accent bg-accent" : "border-white/20 bg-white/3"}`}
                                        aria-hidden="true"
                                    >
                                        {marcada && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                                    </span>
                                    {o.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: o.color }} aria-hidden="true" />}
                                    {o.color === undefined &&
                                        (o.icono ? (
                                            <span className="w-4 shrink-0 text-center leading-none" aria-hidden="true">{o.icono}</span>
                                        ) : (
                                            <Folder className="h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
                                        ))}
                                    <span className="min-w-0 flex-1 truncate">{o.nombre}</span>
                                    {bloqueada && <span className="shrink-0 text-[11px] text-secondary">{o.bloqueo}</span>}
                                </button>
                            </li>
                        )
                    })}
                </ul>
            )}
            <div className="mt-1 flex justify-end gap-2 border-t border-white/8 px-1 pt-2 pb-0.5">
                <Button variant="ghost" size="sm" onClick={onCancelar} disabled={guardando}>
                    Cancelar
                </Button>
                {opciones.length > 0 && (
                    <Button size="sm" onClick={aplicar} isLoading={guardando} disabled={!cambio}>
                        Aplicar
                    </Button>
                )}
            </div>
        </div>
    )
}
