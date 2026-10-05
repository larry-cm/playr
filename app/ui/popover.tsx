"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from "react"
import { createPortal } from "react-dom"

/** Dónde se abre: junto a un elemento (botón ⋯) o en un punto de la pantalla (clic derecho, mantener presionado). */
export type AnclaPopover = HTMLElement | { x: number; y: number }

interface PopoverProps {
    ancla: AnclaPopover
    /** Botón que lo abre: tocarlo no cuenta como "clic afuera" y recibe el foco al cerrar con Esc o al elegir. */
    disparador?: HTMLElement | null
    /** devolverFoco = se cerró con Esc o eligiendo algo (no con un clic afuera). */
    onCerrar: (devolverFoco: boolean) => void
    etiqueta: string
    /** Con un elemento de ancla: borde con el que se alinea. */
    alinear?: "inicio" | "fin"
    /** Cambiarlo vuelve a poner el foco en el primer control (p. ej. al pasar a una subvista). */
    focoKey?: string | number
    className?: string
    children: ReactNode
}

const ENFOCABLES = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
const MARGEN = 8

/**
 * Menú o panel flotante. Va en un portal con posición fija (dentro de una lista con scroll se recortaría) y sigue a su
 * ancla al hacer scroll. Esc lo cierra con preventDefault (un Modal de fondo no se cierra), un clic afuera también, y
 * las flechas ↑/↓ recorren sus botones. Dentro de un diálogo se monta en él, así queda en su trampa de foco.
 */
export default function Popover({ ancla, disparador, onCerrar, etiqueta, alinear = "inicio", focoKey, className = "w-60", children }: Readonly<PopoverProps>) {
    const ref = useRef<HTMLDivElement>(null)
    const onCerrarRef = useRef(onCerrar)
    useEffect(() => {
        onCerrarRef.current = onCerrar
    })

    const cerrar = useCallback(
        (devolverFoco: boolean) => {
            if (devolverFoco && disparador?.isConnected) disparador.focus({ preventScroll: true })
            onCerrarRef.current(devolverFoco)
        },
        [disparador],
    )

    // Se ubica tocando el estilo directo (sin estado): sigue al ancla en cada scroll sin re-renderizar.
    const ubicar = useCallback(() => {
        const el = ref.current
        if (!el) return
        const { width: w, height: h } = el.getBoundingClientRect()
        const a = ancla instanceof HTMLElement ? ancla.getBoundingClientRect() : { left: ancla.x, right: ancla.x, top: ancla.y, bottom: ancla.y }
        // En un punto (clic derecho, mantener presionado) se abre hacia la derecha, como un menú contextual.
        const fin = alinear === "fin" && ancla instanceof HTMLElement
        const left = Math.min(Math.max(MARGEN, fin ? a.right - w : a.left), window.innerWidth - w - MARGEN)
        const abajo = a.bottom + 6
        const arriba = a.top - h - 6
        const top = abajo + h <= window.innerHeight - MARGEN || arriba < MARGEN ? Math.min(abajo, window.innerHeight - h - MARGEN) : arriba
        el.style.top = `${Math.max(MARGEN, top)}px`
        el.style.left = `${left}px`
        el.style.visibility = "visible"
    }, [ancla, alinear])

    useLayoutEffect(() => {
        ubicar()
        ref.current?.querySelector<HTMLElement>(ENFOCABLES)?.focus({ preventScroll: true })
    }, [ubicar, focoKey])

    // El contenido cambia de alto (subvistas): se vuelve a ubicar.
    useEffect(() => {
        const el = ref.current
        if (!el) return
        const observer = new ResizeObserver(ubicar)
        observer.observe(el)
        return () => observer.disconnect()
    }, [ubicar])

    useEffect(() => {
        const fuera = (e: PointerEvent) => {
            const t = e.target as Node
            if (!ref.current?.contains(t) && !disparador?.contains(t)) cerrar(false)
        }
        document.addEventListener("pointerdown", fuera)
        window.addEventListener("resize", ubicar)
        window.addEventListener("scroll", ubicar, true)
        return () => {
            document.removeEventListener("pointerdown", fuera)
            window.removeEventListener("resize", ubicar)
            window.removeEventListener("scroll", ubicar, true)
        }
    }, [disparador, ubicar, cerrar])

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            e.preventDefault()
            e.stopPropagation()
            cerrar(true)
            return
        }
        if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return
        // Las flechas dentro de un campo de texto mueven el cursor, no el foco.
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
        const lista = Array.from(ref.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? [])
        if (lista.length === 0) return
        e.preventDefault()
        const i = lista.indexOf(document.activeElement as HTMLElement)
        const siguiente =
            e.key === "Home" ? 0 : e.key === "End" ? lista.length - 1 : e.key === "ArrowDown" ? (i + 1) % lista.length : (i - 1 + lista.length) % lista.length
        lista[siguiente].focus()
    }

    if (typeof document === "undefined") return null
    const destino = (ancla instanceof HTMLElement ? ancla.closest<HTMLElement>('[role="dialog"]') : null) ?? document.body

    return createPortal(
        <div
            ref={ref}
            role="dialog"
            aria-modal="false"
            aria-label={etiqueta}
            onKeyDown={onKeyDown}
            style={{ top: 0, left: 0, visibility: "hidden" }}
            className={`fixed z-[60] max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[#16161f] p-1.5 shadow-2xl shadow-black/60 [scrollbar-width:thin] ${className}`}
        >
            {children}
        </div>,
        destino,
    )
}

/** Opción de un menú flotante (mismo estilo que el menú de los mensajes). */
export const ITEM_POPOVER =
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-white/90 hover:bg-white/8 focus-visible:bg-white/8 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
