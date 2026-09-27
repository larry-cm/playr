"use client"

import { X } from "lucide-react"
import SelectDropdown from "@ui/select-dropdown"
import { formatCOP } from "@lib/currency"

/**
 * Rangos fijos (no min/max a mano): un clic y listo. Cortes elegidos sobre el catálogo real del proveedor (la mitad de los
 * productos cuesta menos de ~$6.500 y hay combos de cientos de miles). Cada rango incluye su tope: $5.000 cae en "Hasta $5.000".
 */
const RANGOS = [
    { value: "a", label: `Hasta ${formatCOP(5000)}`, min: 0, max: 5000 },
    { value: "b", label: `${formatCOP(5000)} – ${formatCOP(10000)}`, min: 5000, max: 10000 },
    { value: "c", label: `${formatCOP(10000)} – ${formatCOP(20000)}`, min: 10000, max: 20000 },
    { value: "d", label: `Más de ${formatCOP(20000)}`, min: 20000, max: Infinity },
] as const

export interface FiltroCatalogo {
    /** "" = todas; si no, el valor de la columna Plataforma ("Combo" para los combos) */
    plataforma: string
    /** "" = todos; si no, el value de un rango */
    precio: string
    /** "" = todas; si no, el valor de la columna Duración ("1 mes", "3 meses", "30 créditos"…) */
    duracion: string
}

export const SIN_FILTRO: FiltroCatalogo = { plataforma: "", precio: "", duracion: "" }

type Item = { plataforma: string; precio: number; duracion: string }

const DIAS: Record<string, number> = { día: 1, días: 1, mes: 30, meses: 30, año: 365, años: 365 }

/** Días aproximados de una duración de `duracionDe()`, para ordenar las opciones de menor a mayor; los créditos van al final. */
const diasDe = (d: string) => {
    const [n, unidad] = d.split(" ")
    return unidad in DIAS ? Number(n) * DIAS[unidad] : Infinity
}

const enRango = (precio: number, value: string) => {
    const r = RANGOS.find((x) => x.value === value)
    return !r || (precio > r.min && precio <= r.max)
}

const pasaPlataforma = (x: Item, f: FiltroCatalogo) => !f.plataforma || x.plataforma === f.plataforma
const pasaDuracion = (x: Item, f: FiltroCatalogo) => !f.duracion || x.duracion === f.duracion

export const pasaFiltro = (x: Item, f: FiltroCatalogo) => pasaPlataforma(x, f) && enRango(x.precio, f.precio) && pasaDuracion(x, f)

/** Cuántos productos hay por cada valor de `clave`. */
const contar = (items: Item[], clave: (x: Item) => string) => {
    const m = new Map<string, number>()
    for (const x of items) m.set(clave(x), (m.get(clave(x)) ?? 0) + 1)
    return m
}

/** Valores con conteo, más el elegido aunque haya quedado en 0 con los otros filtros (para poder verlo y cambiarlo). */
const valores = (conteo: Map<string, number>, elegido: string) => [...new Set([...conteo.keys(), ...(elegido ? [elegido] : [])])]

interface FiltrosCatalogoProps {
    items: Item[]
    value: FiltroCatalogo
    onChange: (value: FiltroCatalogo) => void
    mobile?: boolean
}

/**
 * Plataforma, rango de precio y duración junto al buscador de la tabla. Cada opción lleva en una pastilla cuántos productos quedarían
 * con los otros filtros ya aplicados (las que quedan en 0 se ven apagadas), así nunca se elige a ciegas una opción vacía.
 */
export default function FiltrosCatalogo({ items, value, onChange, mobile }: Readonly<FiltrosCatalogoProps>) {
    // cada selector cuenta sobre lo que dejan pasar los otros dos
    const sinPlataforma = items.filter((x) => enRango(x.precio, value.precio) && pasaDuracion(x, value))
    const sinPrecio = items.filter((x) => pasaPlataforma(x, value) && pasaDuracion(x, value))
    const sinDuracion = items.filter((x) => pasaPlataforma(x, value) && enRango(x.precio, value.precio))

    const porPlataforma = contar(sinPlataforma, (x) => x.plataforma)
    const porDuracion = contar(sinDuracion, (x) => x.duracion)

    const plataformas = [
        { value: "", label: "Todas las plataformas", count: sinPlataforma.length },
        ...valores(porPlataforma, value.plataforma)
            .sort((a, b) => a.localeCompare(b, "es"))
            .map((n) => ({ value: n, label: n, count: porPlataforma.get(n) ?? 0 })),
    ]
    const precios = [
        { value: "", label: "Cualquier precio", count: sinPrecio.length },
        ...RANGOS.map((r) => ({ value: r.value, label: r.label, count: sinPrecio.filter((x) => enRango(x.precio, r.value)).length })),
    ]
    const duraciones = [
        { value: "", label: "Cualquier duración", count: sinDuracion.length },
        ...valores(porDuracion, value.duracion)
            .sort((a, b) => diasDe(a) - diasDe(b) || a.localeCompare(b, "es", { numeric: true }))
            .map((d) => ({ value: d, label: d, count: porDuracion.get(d) ?? 0 })),
    ]

    const activo = value.plataforma !== "" || value.precio !== "" || value.duracion !== ""

    return (
        <div className={mobile ? "grid grid-cols-2 gap-3" : "flex items-center gap-3"}>
            <div className={mobile ? "min-w-0" : "w-56"}>
                <SelectDropdown options={plataformas} value={value.plataforma} onChange={(plataforma) => onChange({ ...value, plataforma })} />
            </div>
            <div className={mobile ? "min-w-0" : "w-52"}>
                <SelectDropdown options={precios} value={value.precio} onChange={(precio) => onChange({ ...value, precio })} />
            </div>
            <div className={mobile ? "min-w-0" : "w-48"}>
                <SelectDropdown options={duraciones} value={value.duracion} onChange={(duracion) => onChange({ ...value, duracion })} />
            </div>
            {activo && (
                <button
                    type="button"
                    onClick={() => onChange(SIN_FILTRO)}
                    // mismo tono que los botones de fila (IconAction "default"): borde y fondo suaves, acento al pasar el mouse
                    className="inline-flex h-[42px] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/3 px-3.5 text-sm text-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
                >
                    <X className="h-4 w-4" />
                    Limpiar
                </button>
            )}
        </div>
    )
}
