"use client"

import { ReactNode, useEffect, useId, useRef } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

interface ModalProps {
  isOpen: boolean;
  title?: string;
  onClose: () => void;
  children?: ReactNode;
  /** false mientras hay una operación en curso: ESC, el fondo y la X no cierran el modal. */
  dismissible?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const focusables = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0)

/**
 * Diálogo modal: se monta en un portal sobre <body>, deja inerte el resto de la página, atrapa el foco (Tab/Shift+Tab)
 * y al cerrar devuelve el foco a quien lo abrió. Mismo patrón que el drawer de notificaciones.
 */
export default function Modal({ isOpen, title, onClose, children, dismissible = true }: ModalProps) {
  const titleId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  // En refs: así el efecto no se vuelve a suscribir (ni mueve el foco) cada vez que el padre re-renderiza.
  const onCloseRef = useRef(onClose)
  const dismissibleRef = useRef(dismissible)
  useEffect(() => {
    onCloseRef.current = onClose
    dismissibleRef.current = dismissible
  })

  useEffect(() => {
    if (!isOpen) return
    const root = rootRef.current
    const dialog = dialogRef.current
    if (!root || !dialog) return

    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null
    // Si un hijo ya tomó el foco (autoFocus) se respeta; si no, el primer control del contenido y, si no hay, la X.
    if (!dialog.contains(document.activeElement)) {
      const inicial = (bodyRef.current && focusables(bodyRef.current)[0]) ?? focusables(dialog)[0]
      inicial?.focus({ preventScroll: true })
    }

    // El resto de la página queda inerte (fuera del foco, del teclado y de los lectores). Solo se tocan los que no lo
    // estaban, así un modal abierto sobre otro devuelve al cerrar exactamente lo que encontró.
    const inertes = Array.from(document.body.children).filter(
      (el): el is HTMLElement => el !== root && el instanceof HTMLElement && !el.inert && el.tagName !== "SCRIPT",
    )
    inertes.forEach((el) => { el.inert = true })

    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const onKey = (e: KeyboardEvent) => {
      // Un control interno (p. ej. un SelectDropdown abierto) ya consumió el ESC.
      if (e.key === "Escape") {
        if (!e.defaultPrevented && dismissibleRef.current) onCloseRef.current()
        return
      }
      if (e.key !== "Tab") return
      const lista = focusables(dialog)
      if (lista.length === 0) {
        e.preventDefault()
        return
      }
      const primero = lista[0]
      const ultimo = lista[lista.length - 1]
      const activo = document.activeElement
      if (!dialog.contains(activo)) {
        e.preventDefault()
        primero.focus()
      } else if (e.shiftKey && activo === primero) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }
    document.addEventListener("keydown", onKey)

    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = overflowPrevio
      inertes.forEach((el) => { el.inert = false })
      if (previo?.isConnected) previo.focus({ preventScroll: true })
    }
  }, [isOpen])

  if (!isOpen || typeof document === "undefined") return null

  const cerrar = () => {
    if (dismissible) onClose()
  }

  return createPortal(
    <div ref={rootRef} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" aria-hidden="true" onClick={cerrar} />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : "Diálogo"}
        className="relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col rounded-2xl shadow-2xl p-6"
        style={{ background: '#12121a', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex shrink-0 items-start justify-between gap-4">
          <h3 id={titleId} className="text-lg font-semibold text-white/95">{title}</h3>
          {/* 44×44 de área táctil; los márgenes negativos lo dejan donde estaba el botón de 36px. */}
          <button
            type="button"
            onClick={cerrar}
            disabled={!dismissible}
            className="ml-auto -mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-transparent text-secondary transition-colors duration-200 hover:cursor-pointer hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* El título queda fijo y el contenido scrollea dentro del modal si no cabe en la pantalla.
            -mx/px: la barra queda pegada al borde y los anillos de foco no se recortan. */}
        <div ref={bodyRef} className="-mx-6 mt-4 min-h-0 overflow-y-auto px-6 py-1 text-sm text-white/90 [scrollbar-color:rgba(255,255,255,0.15)_transparent] [scrollbar-width:thin]">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
