"use client"

import { useId, useState } from "react"
import { Archive, ArchiveRestore, ChevronRight, FolderPlus, Mail, MailCheck, Pin, PinOff, Tag, Trash2, TriangleAlert } from "lucide-react"
import Popover, { ITEM_POPOVER, type AnclaPopover } from "@ui/popover"
import Button from "@ui/button"
import type { Conversacion } from "@action/manager-and-admin/mensajes/mensajes-action"
import { useBandeja } from "@/app/administrar/mensajes/bandeja-contexto"
import ChecklistAsignar, { opcionesCarpetas, opcionesEtiquetas } from "@/app/administrar/mensajes/checklist-asignar"
import { nombreDe, tieneNoLeido } from "@/app/administrar/mensajes/bandeja-util"

/** Lo que pasa al eliminar un chat (decisión 2026-10-04): solo sale de la bandeja del staff. */
export const TEXTO_ELIMINAR_CHAT = "Se borra de la bandeja del equipo. El cliente conserva su historial y si vuelve a escribir, el chat reaparece solo con lo nuevo."

/** Confirmación de "Eliminar chat" (en el menú y en el panel de detalles). */
export function ConfirmarEliminarChat({ onConfirmar, onCancelar }: Readonly<{ onConfirmar: () => void; onCancelar: () => void }>) {
    const id = useId()
    return (
        <div role="alertdialog" aria-labelledby={`${id}-titulo`} aria-describedby={`${id}-texto`} className="flex flex-col gap-3 p-1.5">
            <div className="flex items-start gap-2.5">
                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-hidden="true" />
                <div className="flex flex-col gap-1">
                    <p id={`${id}-titulo`} className="text-sm font-semibold text-white">¿Eliminar este chat?</p>
                    <p id={`${id}-texto`} className="text-xs leading-5 text-secondary">{TEXTO_ELIMINAR_CHAT}</p>
                </div>
            </div>
            <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={onCancelar}>
                    Cancelar
                </Button>
                <Button variant="danger" size="sm" onClick={onConfirmar} leftIcon={<Trash2 className="h-3.5 w-3.5" />}>
                    Eliminar chat
                </Button>
            </div>
        </div>
    )
}

type Vista = "principal" | "etiquetas" | "carpetas" | "eliminar"

interface MenuChatProps {
    conversacion: Conversacion
    ancla: AnclaPopover
    disparador: HTMLElement | null
    onCerrar: () => void
}

/** Menú de un chat de la lista (⋯, clic derecho o mantener presionado). */
export default function MenuChat({ conversacion: c, ancla, disparador, onCerrar }: Readonly<MenuChatProps>) {
    const { acciones, etiquetas, carpetas, motivoNoFijar, abrirGestor } = useBandeja()
    const [vista, setVista] = useState<Vista>("principal")
    const motivo = motivoNoFijar(c)
    const noLeido = tieneNoLeido(c)

    // Cada opción cierra el menú y devuelve el foco al ⋯ (si el chat sigue en la lista).
    const elegir = (accion: () => void) => () => {
        disparador?.focus({ preventScroll: true })
        onCerrar()
        accion()
    }
    const gestor = (g: "etiquetas" | "carpetas") => () => {
        disparador?.focus({ preventScroll: true })
        onCerrar()
        abrirGestor(g)
    }

    return (
        <Popover ancla={ancla} disparador={disparador} onCerrar={onCerrar} etiqueta={`Opciones del chat con ${nombreDe(c.cliente)}`} alinear="fin" focoKey={vista} className={vista === "eliminar" ? "w-72" : "w-64"}>
            {vista === "principal" && (
                <div className="flex flex-col">
                    <button type="button" className={ITEM_POPOVER} disabled={Boolean(motivo)} onClick={elegir(() => acciones.fijar(c, !c.fijadoEn))}>
                        {c.fijadoEn ? <PinOff className="h-4 w-4 shrink-0 text-secondary" aria-hidden="true" /> : <Pin className="h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />}
                        <span className="flex min-w-0 flex-col">
                            {c.fijadoEn ? "Desfijar" : "Fijar"}
                            {motivo && <span className="text-[11px] leading-4 text-secondary">{motivo}</span>}
                        </span>
                    </button>
                    <button type="button" className={ITEM_POPOVER} onClick={elegir(() => acciones.archivar(c, !c.archivadoEn))}>
                        {c.archivadoEn ? <ArchiveRestore className="h-4 w-4 shrink-0 text-secondary" aria-hidden="true" /> : <Archive className="h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />}
                        {c.archivadoEn ? "Desarchivar" : "Archivar"}
                    </button>
                    <button type="button" className={ITEM_POPOVER} onClick={elegir(() => (noLeido ? acciones.marcarLeido(c) : acciones.marcarNoLeido(c)))}>
                        {noLeido ? <MailCheck className="h-4 w-4 shrink-0 text-secondary" aria-hidden="true" /> : <Mail className="h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />}
                        {noLeido ? "Marcar como leído" : "Marcar como no leído"}
                    </button>
                    <div className="my-1 border-t border-white/8" />
                    <button type="button" className={ITEM_POPOVER} onClick={() => setVista("etiquetas")}>
                        <Tag className="h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
                        <span className="flex-1">Etiquetar…</span>
                        <ChevronRight className="h-4 w-4 text-secondary" aria-hidden="true" />
                    </button>
                    <button type="button" className={ITEM_POPOVER} onClick={() => setVista("carpetas")}>
                        <FolderPlus className="h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
                        <span className="flex-1">Mover a carpeta…</span>
                        <ChevronRight className="h-4 w-4 text-secondary" aria-hidden="true" />
                    </button>
                    <div className="my-1 border-t border-white/8" />
                    <button type="button" className={`${ITEM_POPOVER} text-red-300 hover:bg-red-500/10 focus-visible:bg-red-500/10`} onClick={() => setVista("eliminar")}>
                        <Trash2 className="h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
                        Eliminar chat
                    </button>
                </div>
            )}

            {vista === "etiquetas" && (
                <ChecklistAsignar
                    titulo="Etiquetas del chat"
                    opciones={opcionesEtiquetas(etiquetas)}
                    inicial={c.etiquetas}
                    onAplicar={(ids) => acciones.asignarEtiquetas(c, ids)}
                    onCancelar={() => setVista("principal")}
                    onListo={elegir(() => {})}
                    vacio={
                        <span className="flex flex-col items-start gap-2">
                            Aún no hay etiquetas.
                            <Button variant="secondary" size="sm" onClick={gestor("etiquetas")}>Crear etiquetas</Button>
                        </span>
                    }
                />
            )}

            {vista === "carpetas" && (
                <ChecklistAsignar
                    titulo="Carpetas del chat"
                    opciones={opcionesCarpetas(carpetas)}
                    inicial={c.carpetas}
                    onAplicar={(ids) => acciones.asignarCarpetas(c, ids)}
                    onCancelar={() => setVista("principal")}
                    onListo={elegir(() => {})}
                    vacio={
                        <span className="flex flex-col items-start gap-2">
                            Aún no hay carpetas.
                            <Button variant="secondary" size="sm" onClick={gestor("carpetas")}>Crear carpetas</Button>
                        </span>
                    }
                />
            )}

            {vista === "eliminar" && <ConfirmarEliminarChat onCancelar={() => setVista("principal")} onConfirmar={elegir(() => acciones.eliminar(c))} />}
        </Popover>
    )
}
