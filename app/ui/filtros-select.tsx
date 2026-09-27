"use client"

import { X } from "lucide-react"
import SelectDropdown from "@ui/select-dropdown"

/** Un filtro de lista desplegable: sus opciones salen de los valores presentes en las filas. */
export interface CampoFiltro<T> {
    key: string
    /** Texto de la opción "sin filtro" ("Todas las plataformas"). */
    todas: string
    valor: (row: T) => string
    etiqueta: (row: T) => string
    /** Orden fijo de los valores (p. ej. estados); sin él, alfabético por etiqueta. */
    orden?: string[]
    /** Ancho máximo en escritorio (clase Tailwind max-w-*): si el texto no cabe, se trunca con «…». */
    width: string
    /** En móvil ocupa toda la fila y va primero (p. ej. el correo, que es largo). */
    ancho?: boolean
}

export type Filtro = Record<string, string>

export const sinFiltro = <T,>(campos: CampoFiltro<T>[]): Filtro => Object.fromEntries(campos.map((c) => [c.key, ""]))

const pasa = <T,>(row: T, campos: CampoFiltro<T>[], f: Filtro, salvo?: string) =>
    campos.every((c) => c.key === salvo || !f[c.key] || c.valor(row) === f[c.key])

export const pasaFiltro = <T,>(row: T, campos: CampoFiltro<T>[], f: Filtro) => pasa(row, campos, f)

interface FiltrosSelectProps<T> {
    campos: CampoFiltro<T>[]
    items: T[]
    value: Filtro
    onChange: (value: Filtro) => void
    mobile?: boolean
}

/**
 * Filtros junto al buscador de una tabla (Cuentas, Perfiles). Cada opción lleva en una pastilla cuántas filas quedarían con los
 * otros filtros ya aplicados; las que quedan en 0 se ven apagadas y lo elegido se lista aunque quede en 0, para poder cambiarlo.
 */
export default function FiltrosSelect<T>({ campos, items, value, onChange, mobile }: Readonly<FiltrosSelectProps<T>>) {
    const opciones = (campo: CampoFiltro<T>) => {
        const base = items.filter((row) => pasa(row, campos, value, campo.key))
        const nombres = new Map<string, string>()
        const conteo = new Map<string, number>()
        for (const row of items) nombres.set(campo.valor(row), campo.etiqueta(row))
        for (const row of base) conteo.set(campo.valor(row), (conteo.get(campo.valor(row)) ?? 0) + 1)
        const elegido = value[campo.key]
        const valores = [...new Set([...conteo.keys(), ...(elegido ? [elegido] : [])])]
        valores.sort((a, b) =>
            campo.orden
                ? campo.orden.indexOf(a) - campo.orden.indexOf(b)
                : (nombres.get(a) ?? a).localeCompare(nombres.get(b) ?? b, "es"),
        )
        return [
            { value: "", label: campo.todas, count: base.length },
            ...valores.map((v) => ({ value: v, label: nombres.get(v) ?? v, count: conteo.get(v) ?? 0 })),
        ]
    }

    const activo = campos.some((c) => value[c.key])

    return (
        <div className={mobile ? "grid grid-cols-2 gap-3" : "flex min-w-0 flex-1 flex-nowrap items-center gap-3"}>
            {campos.map((campo) => (
                <div key={campo.key} className={mobile ? (campo.ancho ? "order-first col-span-2 min-w-0" : "min-w-0") : `min-w-0 flex-1 ${campo.width}`}>
                    <SelectDropdown
                        options={opciones(campo)}
                        value={value[campo.key] ?? ""}
                        onChange={(v) => onChange({ ...value, [campo.key]: v })}
                    />
                </div>
            ))}
            {activo && (
                <button
                    type="button"
                    onClick={() => onChange(sinFiltro(campos))}
                    // mismo tono que los botones de fila (IconAction "default"): borde y fondo suaves, acento al pasar el mouse
                    className={`inline-flex h-[42px] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/3 px-3.5 text-sm text-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 ${mobile ? "col-span-2" : ""}`}
                >
                    <X className="h-4 w-4" />
                    Limpiar
                </button>
            )}
        </div>
    )
}
