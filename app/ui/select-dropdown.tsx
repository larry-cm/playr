"use client"
import { useState, useRef, useEffect, useId, type ReactNode, type KeyboardEvent } from "react"
import { TriangleAlert, ChevronDown, Search } from "lucide-react"
import type { ValidationState } from "@ui/input"

export interface DropdownOption {
  value: string;
  label: string;
  dropdownLabel?: string;
  icon?: ReactNode;
  /** Cantidad de resultados de la opción: se muestra a la derecha en una pastilla; en 0 la opción se ve apagada. */
  count?: number;
  /** Nombre para lectores de pantalla y la búsqueda cuando el texto visible no basta (p. ej. solo una bandera). */
  srLabel?: string;
}

interface SelectDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  /** Nombre accesible cuando no hay `label` visible (p. ej. filtros junto al buscador). */
  ariaLabel?: string;
  placeholder?: string;
  error?: string | string[];
  required?: boolean;
  className?: string;
  name?: string;
  id?: string;
  validation?: ValidationState;
  disabled?: boolean;
}

const borderByValidation: Record<ValidationState, string> = {
  idle: "border-white/[0.1]",
  valid: "border-emerald-500/50 focus:border-emerald-400 focus:ring-emerald-400/40",
  invalid: "border-red-500/50 focus:border-red-400 focus:ring-red-400/40",
}

/**
 * Lista desplegable con buscador (patrón combobox + listbox): el botón abre la lista, el buscador recibe el foco y las
 * flechas/Home/End mueven la opción activa; Enter (o Espacio con el buscador vacío) elige, ESC y Tab cierran.
 */
export default function SelectDropdown({
  options,
  value,
  onChange,
  label,
  ariaLabel,
  placeholder = "Seleccionar...",
  error,
  required,
  className = "",
  name,
  id,
  validation,
  disabled,
}: SelectDropdownProps) {
  const autoId = useId()
  const buttonId = id ?? `${autoId}-boton`
  const labelId = `${autoId}-label`
  const listId = `${autoId}-lista`
  const errorId = `${autoId}-error`
  const optionId = (i: number) => `${autoId}-opcion-${i}`

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [active, setActive] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const selected = options.find((o) => o.value === value)
  const errors = error ? (Array.isArray(error) ? error : [error]) : []

  const filtrar = (texto: string) =>
    texto
      ? options.filter((o) => `${o.dropdownLabel ?? o.label} ${o.srLabel ?? ""}`.toLowerCase().includes(texto.toLowerCase()))
      : options
  const filtered = filtrar(search)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const abrir = (texto = "") => {
    const lista = filtrar(texto)
    const elegido = lista.findIndex((o) => o.value === value)
    setSearch(texto)
    setActive(elegido >= 0 ? elegido : 0)
    setOpen(true)
  }

  const cerrar = (devolverFoco = true) => {
    setOpen(false)
    setSearch("")
    if (devolverFoco) buttonRef.current?.focus()
  }

  const handleSelect = (opt: DropdownOption) => {
    onChange(opt.value)
    cerrar()
  }

  const moverA = (i: number) => {
    if (filtered.length === 0) return
    const next = Math.max(0, Math.min(filtered.length - 1, i))
    setActive(next)
    document.getElementById(optionId(next))?.scrollIntoView({ block: "nearest" })
  }

  const handleButtonKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (open) return
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      abrir()
    } else if (e.key.length === 1 && e.key !== " " && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Escribir sobre el botón abre la lista ya filtrada por esa letra.
      e.preventDefault()
      abrir(e.key)
    }
  }

  const handleListKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        moverA(active + 1)
        break
      case "ArrowUp":
        e.preventDefault()
        moverA(active - 1)
        break
      case "Home":
        e.preventDefault()
        moverA(0)
        break
      case "End":
        e.preventDefault()
        moverA(filtered.length - 1)
        break
      case "Enter":
        e.preventDefault()
        if (filtered[active]) handleSelect(filtered[active])
        break
      case " ":
        // Con texto escrito el espacio es parte de la búsqueda ("Netflix Pantalla").
        if (search === "" && filtered[active]) {
          e.preventDefault()
          handleSelect(filtered[active])
        }
        break
      case "Escape":
        // Solo cierra la lista: el modal que la contiene no debe cerrarse con este ESC.
        e.preventDefault()
        e.stopPropagation()
        cerrar()
        break
      case "Tab":
        e.preventDefault()
        cerrar()
        break
    }
  }

  const focusSearchInput = (el: HTMLInputElement | null) => {
    if (el && open && document.activeElement !== el) {
      el.focus()
      if (search) {
        el.setSelectionRange(search.length, search.length)
      }
    }
  }

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      {label && (
        <label id={labelId} htmlFor={buttonId} className="text-sm font-medium text-secondary">
          {label}{required && <span className="text-accent ml-0.5" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="relative">
        <input type="hidden" name={name} value={value} />

        <button
          ref={buttonRef}
          type="button"
          id={buttonId}
          disabled={disabled}
          onClick={() => (open ? cerrar(false) : abrir())}
          onKeyDown={handleButtonKeyDown}
          title={selected?.label || ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-label={label ? undefined : ariaLabel}
          aria-labelledby={label ? `${labelId} ${buttonId}` : undefined}
          aria-describedby={errors.length > 0 ? errorId : undefined}
          className={`w-full min-w-0 overflow-hidden flex items-center gap-2 bg-white/5 border rounded-xl py-2.5 pl-3.5 pr-10 text-sm text-white outline-none transition-all duration-200 focus:border-accent focus:ring-1 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60 ${borderByValidation[errors.length > 0 ? "invalid" : validation ?? "idle"]} ${className}`}
        >
          {selected?.icon && <span className="shrink-0" aria-hidden="true">{selected.icon}</span>}
          <span className={`min-w-0 truncate ${selected ? "text-white" : "text-muted"}`}>
            {selected ? selected.label : placeholder}
          </span>
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted shrink-0 pointer-events-none">
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </div>
        </button>

        {open && (
          <div className="absolute z-50 mt-1.5 w-full bg-background border border-white/10 rounded-xl shadow-2xl overflow-hidden">
            <div className="relative border-b border-white/6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" aria-hidden="true" />
              <input
                ref={focusSearchInput}
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={filtered[active] ? optionId(active) : undefined}
                aria-label={`Buscar en ${label ?? ariaLabel ?? "la lista"}`}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setActive(0)
                }}
                onKeyDown={handleListKeyDown}
                placeholder="Buscar..."
                className="w-full bg-transparent py-2.5 pl-9 pr-3 text-sm text-white placeholder-muted outline-none"
              />
            </div>
            <ul id={listId} role="listbox" aria-label={label ?? ariaLabel} className="max-h-48 overflow-y-auto">
              {filtered.length === 0 ? (
                <li role="presentation" className="py-3 px-3.5 text-sm text-muted text-center">
                  Sin resultados
                </li>
              ) : (
                filtered.map((opt, i) => (
                  <li
                    key={opt.value}
                    id={optionId(i)}
                    role="option"
                    aria-selected={opt.value === value}
                    aria-label={opt.srLabel}
                    // mousedown sin foco: el buscador conserva el foco hasta elegir
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => handleSelect(opt)}
                    className={`w-full flex cursor-pointer items-center gap-2 px-3.5 py-2.5 text-sm text-left transition-colors ${i === active ? "bg-white/8" : ""} ${opt.value === value
                      ? "text-accent bg-accent/5"
                      : "text-white"
                      }`}
                  >
                    {opt.icon && <span className="shrink-0" aria-hidden="true">{opt.icon}</span>}
                    <span title={opt.dropdownLabel ?? opt.label} className={`min-w-0 truncate ${opt.count === 0 && opt.value !== value ? "text-muted" : ""}`}>{opt.dropdownLabel ?? opt.label}</span>
                    {opt.count !== undefined && (
                      <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs tabular-nums ${opt.value === value ? "bg-accent/15 text-accent" : "bg-white/5 text-secondary"}`}>
                        {opt.count}
                      </span>
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
      {errors.length > 0 && (
        <div id={errorId} className="flex flex-col gap-0.5 mt-0.5">
          {errors.map((msg, i) => (
            <p key={i} className="text-red-400 text-xs flex items-center gap-1">
              <TriangleAlert className="w-3 h-3 shrink-0" aria-hidden="true" />
              {msg}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
