"use client"

import { useEffect, useRef, useState } from "react"
import { Archive, ChevronRight, Ellipsis, MessageCircle, Pin } from "lucide-react"
import { SkeletonBar } from "@ui/data-frame"
import type { AnclaPopover } from "@ui/popover"
import type { Conversacion, Etiqueta } from "@action/manager-and-admin/mensajes/mensajes-action"
import { useBandeja } from "@/app/administrar/mensajes/bandeja-contexto"
import MenuChat from "@/app/administrar/mensajes/menu-chat"
import { horaCorta, inicialDe, nombreDe, tieneNoLeido } from "@/app/administrar/mensajes/bandeja-util"

/** Mantener presionado (táctil) abre el menú del chat. */
const PRESION_MS = 450
const CHIPS_MAX = 2

interface MenuAbierto {
    id: string
    ancla: AnclaPopover
    disparador: HTMLElement | null
}

/** Etiquetas del chat: las 2 primeras y "+N". Punto de color + nombre en gris (los colores no siempre contrastan como texto). */
export function ChipsEtiquetas({ ids, etiquetas, max = CHIPS_MAX }: Readonly<{ ids: number[]; etiquetas: Etiqueta[]; max?: number }>) {
    const lista = etiquetas.filter((e) => ids.includes(e.id))
    if (lista.length === 0) return null
    const resto = lista.length - max
    return (
        <span className="flex min-w-0 items-center gap-1">
            {lista.slice(0, max).map((e) => (
                <span key={e.id} className="flex min-w-0 items-center gap-1 rounded-full bg-white/6 px-1.5 py-px text-[10px] leading-4 text-white/80">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: e.color }} aria-hidden="true" />
                    <span className="truncate">{e.nombre}</span>
                </span>
            ))}
            {resto > 0 && <span className="shrink-0 text-[10px] leading-4 text-secondary" title={lista.slice(max).map((e) => e.nombre).join(", ")}>+{resto}</span>}
        </span>
    )
}

interface ListaProps {
    id: string
    /** undefined = cargando. Ya filtrada y ordenada. */
    lista: Conversacion[] | undefined
    seleccionado: string | null
    onElegir: (clienteId: string) => void
    /** Entrada "Archivados" arriba (solo en "Todos" y si hay alguno). */
    archivados: { n: number; noLeidos: number } | null
    onAbrirArchivados: () => void
    vacio: string
}

export default function ListaChats({ id, lista, seleccionado, onElegir, archivados, onAbrirArchivados, vacio }: Readonly<ListaProps>) {
    const { etiquetas } = useBandeja()
    const [menu, setMenu] = useState<MenuAbierto | null>(null)
    const presion = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null)
    // Tras abrir el menú manteniendo presionado, el "click" que llega al soltar no abre el chat.
    const ignorarClick = useRef(false)
    useEffect(() => () => clearTimeout(presion.current?.timer), [])

    const cancelarPresion = () => {
        clearTimeout(presion.current?.timer)
        presion.current = null
    }
    const abrirMenu = (c: Conversacion, ancla: AnclaPopover, disparador: HTMLElement | null) => setMenu({ id: c.cliente_id, ancla, disparador })
    const abierta = menu ? lista?.find((c) => c.cliente_id === menu.id) : undefined

    return (
        <ul
            id={id}
            className="-mr-1.5 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain pr-1.5 [scrollbar-color:rgb(255_255_255/0.2)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin]"
        >
            {lista === undefined &&
                Array.from({ length: 5 }, (_, i) => (
                    <li key={i} className="flex items-center gap-3 px-2.5 py-2" aria-hidden="true">
                        <SkeletonBar className="h-10 w-10 shrink-0 rounded-full!" />
                        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                            <SkeletonBar className="h-4 w-2/3" />
                            <SkeletonBar className="h-3.5 w-full" />
                        </span>
                    </li>
                ))}

            {archivados && (
                <li>
                    <button
                        type="button"
                        onClick={onAbrirArchivados}
                        className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50"
                    >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/6 text-secondary">
                            <Archive className="h-[18px] w-[18px]" aria-hidden="true" />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="text-sm text-white/90">Archivados</span>
                            <span className="text-xs text-secondary">
                                {archivados.n} {archivados.n === 1 ? "chat" : "chats"}
                                {archivados.noLeidos > 0 && <span className="text-white/75"> · {archivados.noLeidos} sin leer</span>}
                            </span>
                        </span>
                        <ChevronRight className="h-4 w-4 text-secondary" aria-hidden="true" />
                    </button>
                </li>
            )}

            {lista?.length === 0 && (
                <li className="flex flex-col items-center gap-2 px-3 py-10 text-center text-secondary">
                    <MessageCircle className="h-6 w-6" aria-hidden="true" />
                    <span className="text-sm">{vacio}</span>
                </li>
            )}

            {lista?.map((c) => {
                const nombre = nombreDe(c.cliente)
                const activo = seleccionado === c.cliente_id
                const noLeido = tieneNoLeido(c)
                const conMenu = menu?.id === c.cliente_id
                return (
                    <li key={c.cliente_id} className="group relative">
                        <button
                            type="button"
                            onClick={() => {
                                if (ignorarClick.current) {
                                    ignorarClick.current = false
                                    return
                                }
                                onElegir(c.cliente_id)
                            }}
                            onContextMenu={(e) => {
                                e.preventDefault()
                                cancelarPresion()
                                abrirMenu(c, { x: e.clientX, y: e.clientY }, e.currentTarget)
                            }}
                            onPointerDown={(e) => {
                                // Algunos navegadores no mandan "click" después de mantener presionado: se reinicia en cada toque.
                                ignorarClick.current = false
                                if (e.pointerType !== "touch") return
                                const disparador = e.currentTarget
                                const { clientX: x, clientY: y } = e
                                cancelarPresion()
                                presion.current = {
                                    x,
                                    y,
                                    timer: setTimeout(() => {
                                        ignorarClick.current = true
                                        abrirMenu(c, { x, y }, disparador)
                                    }, PRESION_MS),
                                }
                            }}
                            onPointerMove={(e) => {
                                const p = presion.current
                                if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) cancelarPresion()
                            }}
                            onPointerUp={cancelarPresion}
                            onPointerCancel={cancelarPresion}
                            aria-current={activo ? "true" : undefined}
                            className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors select-none [-webkit-touch-callout:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50 ${
                                activo ? "bg-white/8" : "hover:bg-white/4"
                            }`}
                        >
                            <span
                                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold ${noLeido ? "bg-accent/25 text-white" : "bg-white/8 text-white/75"}`}
                                aria-hidden="true"
                            >
                                {inicialDe(nombre)}
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="flex items-center gap-1.5">
                                    <span className={`min-w-0 truncate text-sm ${noLeido ? "font-semibold text-white" : "text-white/90"}`}>{nombre}</span>
                                    {c.fijadoEn && (
                                        <>
                                            <Pin className="h-3 w-3 shrink-0 rotate-45 text-secondary" aria-hidden="true" />
                                            <span className="sr-only">(fijado)</span>
                                        </>
                                    )}
                                    {/* Con el mouse encima, el ⋯ ocupa el lugar de la hora (sin mover nada). En táctil el ⋯ está siempre: la hora se corre a su izquierda. */}
                                    <span
                                        suppressHydrationWarning
                                        className={`ml-auto shrink-0 pl-1 text-[11px] tabular-nums [@media(hover:none)]:mr-6 ${noLeido ? "text-accent-hover" : "text-secondary/80"} ${conMenu ? "[@media(hover:hover)]:opacity-0" : "[@media(hover:hover)]:group-focus-within:opacity-0 [@media(hover:hover)]:group-hover:opacity-0"}`}
                                    >
                                        {horaCorta(c.ultimo.created_at)}
                                    </span>
                                </span>
                                <span className="flex items-center gap-2">
                                    <span className="min-w-0 flex-1 truncate text-xs text-secondary">
                                        {c.ultimo.autor === "asesor" && <span className="text-white/55">Tú: </span>}
                                        {c.ultimo.texto}
                                    </span>
                                    {c.sinLeer > 0 ? (
                                        <span className="shrink-0 rounded-full bg-accent px-1.5 text-[11px] leading-[18px] font-semibold tabular-nums text-white">
                                            <span className="sr-only">Sin leer: </span>
                                            {c.sinLeer}
                                        </span>
                                    ) : (
                                        c.noLeidoManual && (
                                            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent">
                                                <span className="sr-only">Marcado como no leído</span>
                                            </span>
                                        )
                                    )}
                                </span>
                                {c.etiquetas.length > 0 && (
                                    <span className="mt-0.5 flex">
                                        <ChipsEtiquetas ids={c.etiquetas} etiquetas={etiquetas} />
                                    </span>
                                )}
                            </span>
                        </button>
                        <button
                            type="button"
                            aria-label={`Opciones del chat con ${nombre}`}
                            aria-haspopup="dialog"
                            aria-expanded={conMenu}
                            onClick={(e) => (conMenu ? setMenu(null) : abrirMenu(c, e.currentTarget, e.currentTarget))}
                            className={`absolute top-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full bg-[#1c1c26] text-secondary shadow-sm transition-opacity hover:text-white focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 [@media(hover:none)]:bg-transparent [@media(hover:none)]:shadow-none ${
                                conMenu
                                    ? "text-white opacity-100"
                                    : "opacity-60 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100"
                            }`}
                        >
                            <Ellipsis className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </li>
                )
            })}

            {menu && abierta && <MenuChat key={menu.id} conversacion={abierta} ancla={menu.ancla} disparador={menu.disparador} onCerrar={() => setMenu(null)} />}
        </ul>
    )
}
