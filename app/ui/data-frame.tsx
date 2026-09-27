"use client"

import type { ComponentType, CSSProperties, ReactNode } from "react"
import { Search } from "lucide-react"

/*
 * Piezas comunes de las tablas del panel (Table genérica, Productos, Cuentas, Perfiles, historial de Bodega).
 * Todas las medidas viven acá: marco, alto del área con scroll, densidad de filas y botones. Si cada módulo
 * copiaba el marco a mano, las tablas terminaban con alturas y paddings distintos y la vista "saltaba" al navegar.
 */

/** Alto del área con scroll de las tablas CRUD: el mismo en todos los módulos, haya pocas o muchas filas. */
export const TABLE_BODY_HEIGHT = "h-[480px]"
/** Para listas que suelen ser cortas (p. ej. el historial): mismo tope, sin hueco vacío con pocas filas. */
export const TABLE_BODY_MAX_HEIGHT = "max-h-[480px]"

/** Clase de cada fila de datos en escritorio. */
export const ROW_CLASS = "transition-colors hover:bg-white/3"

const FRAME_STYLE: CSSProperties = {
    background: "linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.012))",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 8px 24px rgba(2,6,23,0.28), inset 0 1px 0 rgba(255,255,255,0.04)",
    backdropFilter: "blur(10px)",
}

const MOBILE_CARD_STYLE: CSSProperties = {
    background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 6px 16px rgba(2,6,23,0.25)",
}

const CELL_BORDER = "1px solid rgba(255,255,255,0.05)"

interface SearchInputProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    className?: string
}

/** Buscador de las barras de tabla: 42px de alto, igual que el resto de controles de la barra. */
export function SearchInput({ value, onChange, placeholder = "Buscar", className = "w-full sm:max-w-sm" }: Readonly<SearchInputProps>) {
    return (
        <div className={`relative ${className}`}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
            <input
                type="search"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-xl border border-white/10 bg-white/3 py-2.5 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-muted focus:border-accent/40 focus:ring-1 focus:ring-accent/20"
            />
        </div>
    )
}

interface FrameProps {
    /** Barra superior (buscador + botones). Sin barra, la tabla ocupa todo el marco. */
    toolbar?: ReactNode
    /** TABLE_BODY_HEIGHT (por defecto) o TABLE_BODY_MAX_HEIGHT. */
    bodyHeight?: string
    /** Encabezado de la sección (SectionHeader) DENTRO del marco, con la línea divisoria de las tarjetas del panel. */
    heading?: ReactNode
    /** Desde lg ocupa el alto de su contenedor (el área con scroll se estira) en vez de usar bodyHeight; debajo de lg, bodyHeight. */
    fill?: boolean
    children: ReactNode
}

/** Marco de escritorio (md+): barra arriba y tabla con encabezado fijo dentro de un área de alto constante. */
export function TableFrame({ toolbar, bodyHeight = TABLE_BODY_HEIGHT, heading, fill, children }: Readonly<FrameProps>) {
    return (
        <div className={`hidden md:block overflow-hidden rounded-2xl ${fill ? "lg:flex lg:h-full lg:flex-col" : ""}`} style={FRAME_STYLE}>
            {/* mismo p-6 y línea que Card + SectionHeader (p. ej. "Resumen de Servicios") */}
            {heading && (
                <div className="px-6 pt-6">
                    {heading}
                    <div className="mt-6 border-t border-white/6" />
                </div>
            )}
            <div className={`${heading ? "px-4 pb-4 pt-6" : "p-4"} ${fill ? "lg:flex lg:min-h-0 lg:flex-1 lg:flex-col" : ""}`}>
                {toolbar && (
                    <div className="mb-4 flex min-h-[42px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        {toolbar}
                    </div>
                )}
                <div className={`${bodyHeight} overflow-y-auto overscroll-contain ${fill ? "lg:h-auto lg:max-h-none lg:min-h-0 lg:flex-1" : ""}`}>
                    <table className="w-full border-collapse text-left text-sm text-foreground">{children}</table>
                </div>
            </div>
        </div>
    )
}

/** Versión móvil (< md) del mismo marco: barra en su propio bloque y una tarjeta por fila. */
export function MobileFrame({ toolbar, bodyHeight = TABLE_BODY_HEIGHT, heading, children }: Readonly<FrameProps>) {
    return (
        <div className="md:hidden flex flex-col gap-3">
            {(heading || toolbar) && (
                <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/3 p-3">
                    {heading && <div className="p-1">{heading}</div>}
                    {toolbar}
                </div>
            )}
            <div className={`${bodyHeight} overflow-y-auto overscroll-contain flex flex-col gap-3`}>{children}</div>
        </div>
    )
}

/** Encabezado de columna. Queda fijo al hacer scroll; el borde va como sombra porque el de la celda se pierde al fijarla. */
export function Th({ children, className = "" }: Readonly<{ children: ReactNode; className?: string }>) {
    return (
        <th
            className={`sticky top-0 z-10 bg-[#101015] px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary shadow-[inset_0_-1px_0_rgba(255,255,255,0.08)] ${className}`}
        >
            {children}
        </th>
    )
}

interface TdProps {
    children?: ReactNode
    className?: string
    style?: CSSProperties
    colSpan?: number
}

/** Celda de datos: la misma densidad (px-4 py-3) en todas las tablas. */
export function Td({ children, className = "", style, colSpan }: Readonly<TdProps>) {
    return (
        <td colSpan={colSpan} className={`px-4 py-3 align-middle ${className}`} style={{ borderBottom: CELL_BORDER, ...style }}>
            {children}
        </td>
    )
}

/** Fila única para "sin datos" o "error" dentro de la tabla. */
export function EmptyRow({ colSpan, children, className = "text-secondary" }: Readonly<{ colSpan: number; children: ReactNode; className?: string }>) {
    return (
        <tr>
            <td colSpan={colSpan} className={`px-4 py-8 text-center text-sm ${className}`}>
                {children}
            </td>
        </tr>
    )
}

/** Encabezado de la columna de acciones: a la izquierda y ajustado al ancho de los botones, igual que su celda. */
export function ActionsTh() {
    return <Th className="w-px whitespace-nowrap">Acciones</Th>
}

/** Última columna: botones alineados a la izquierda, bajo su encabezado. w-px la ajusta al ancho de los botones. */
export function ActionsCell({ children }: Readonly<{ children: ReactNode }>) {
    return (
        <Td className="w-px whitespace-nowrap text-left">
            <div className="inline-flex items-center gap-2">{children}</div>
        </Td>
    )
}

type Tone = "default" | "danger" | "accent"

const TONE: Record<Tone, string> = {
    default: "border-white/10 bg-white/3 text-foreground hover:border-accent/30 hover:bg-accent/10 hover:text-accent focus-visible:ring-accent/25",
    danger: "border-red-400/20 bg-red-500/10 text-red-400 hover:border-red-400/30 hover:bg-red-500/15 focus-visible:ring-red-400/25",
    accent: "border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 focus-visible:ring-accent/25",
}

interface ActionProps {
    icon: ComponentType<{ className?: string }>
    label: string
    onClick: () => void
    tone?: Tone
    title?: string
    disabled?: boolean
    /** Gira el ícono (acción en curso). */
    spinning?: boolean
}

const ACTION_BASE =
    "h-9 cursor-pointer items-center justify-center rounded-xl border transition-all duration-200 focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60"

/** Botón de acción de fila en escritorio: solo ícono, 36×36. */
export function IconAction({ icon: Icon, label, onClick, tone = "default", title, disabled, spinning }: Readonly<ActionProps>) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            title={title ?? label}
            className={`flex w-9 shrink-0 ${ACTION_BASE} ${TONE[tone]}`}
        >
            <Icon className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} />
        </button>
    )
}

/** Botón de acción de fila en móvil: ícono + texto, mismo alto que en escritorio. */
export function MobileAction({ icon: Icon, label, onClick, tone = "default", title, disabled, spinning }: Readonly<ActionProps>) {
    return (
        <button type="button" onClick={onClick} disabled={disabled} title={title} className={`inline-flex px-3 text-sm ${ACTION_BASE} ${TONE[tone]}`}>
            <Icon className={`mr-2 h-4 w-4 ${spinning ? "animate-spin" : ""}`} />
            {label}
        </button>
    )
}

export interface MobileField {
    label: string
    value: ReactNode
    className?: string
    style?: CSSProperties
}

/** Tarjeta de una fila en móvil. shrink-0: sin esto, con más filas que el alto fijo las tarjetas se comprimen y ocultan campos. */
export function MobileCard({ fields, actions }: Readonly<{ fields: MobileField[]; actions?: ReactNode }>) {
    return (
        <div className="shrink-0 overflow-hidden rounded-2xl" style={MOBILE_CARD_STYLE}>
            <div className="p-4">
                {fields.map((field) => (
                    <div key={field.label} className="flex items-start justify-between gap-3 py-2">
                        <div className="shrink-0 text-xs font-medium text-secondary">{field.label}</div>
                        <div className={`min-w-0 break-words text-right text-sm text-foreground ${field.className ?? ""}`} style={field.style}>
                            {field.value}
                        </div>
                    </div>
                ))}
                {actions && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">{actions}</div>}
            </div>
        </div>
    )
}

/** Mensaje "sin datos" o "error" de la versión móvil. */
export function MobileEmpty({ children, className = "text-secondary" }: Readonly<{ children: ReactNode; className?: string }>) {
    return <div className={`px-4 py-6 text-center text-sm ${className}`}>{children}</div>
}
