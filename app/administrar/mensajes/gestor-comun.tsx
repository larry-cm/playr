"use client"

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react"
import { TriangleAlert } from "lucide-react"
import Button from "@ui/button"

/** Botón de icono de las filas de los gestores (36px, como IconAction de las tablas). */
export const BotonIcono = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { etiqueta: string; peligro?: boolean }>(
    ({ etiqueta, peligro = false, className = "", children, ...rest }, ref) => (
        <button
            ref={ref}
            type="button"
            aria-label={etiqueta}
            title={etiqueta}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent ${
                peligro ? "hover:bg-red-500/10 hover:text-red-300" : "hover:bg-white/8 hover:text-white"
            } ${className}`}
            {...rest}
        >
            {children}
        </button>
    ),
)
BotonIcono.displayName = "BotonIcono"

/** Tras cancelar una edición o un borrado en la fila, el foco vuelve a su botón (que se vuelve a montar). */
export const enfocarBoton = (etiqueta: string) =>
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`button[aria-label="${CSS.escape(etiqueta)}"]`)?.focus({ preventScroll: true }))

/** "N de 20": cuántos hay y el máximo; en ámbar al llegar al límite. */
export function Limite({ n, max, que }: Readonly<{ n: number; max: number; que: string }>) {
    return (
        <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${n >= max ? "bg-amber-500/10 text-amber-300" : "bg-white/6 text-secondary"}`}>
            {n} de {max} {que}
        </span>
    )
}

/** Confirmación de borrado dentro de la fila (Esc cancela sin cerrar el modal). */
export function ConfirmarFila({ titulo, detalle, cargando, onConfirmar, onCancelar }: Readonly<{ titulo: string; detalle: ReactNode; cargando: boolean; onConfirmar: () => void; onCancelar: () => void }>) {
    return (
        <div
            role="alertdialog"
            aria-label={titulo}
            onKeyDown={(e) => {
                if (e.key === "Escape" && !cargando) {
                    e.preventDefault()
                    onCancelar()
                }
            }}
            className="flex flex-col gap-2.5 rounded-xl border border-red-500/20 bg-red-500/5 p-3 sm:flex-row sm:items-center"
        >
            <div className="flex min-w-0 flex-1 items-start gap-2">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
                <div className="min-w-0 text-sm">
                    <p className="font-medium text-white">{titulo}</p>
                    <p className="text-xs text-secondary">{detalle}</p>
                </div>
            </div>
            <div className="flex shrink-0 justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={onCancelar} disabled={cargando} autoFocus>
                    Cancelar
                </Button>
                <Button variant="danger" size="sm" onClick={onConfirmar} isLoading={cargando}>
                    Eliminar
                </Button>
            </div>
        </div>
    )
}

/** Contador de caracteres de un campo (en rojo si se pasa). */
export function Contador({ n, max }: Readonly<{ n: number; max: number }>) {
    return (
        <span className={`text-[11px] tabular-nums ${n > max ? "text-red-400" : "text-secondary"}`} aria-hidden="true">
            {n}/{max}
        </span>
    )
}
