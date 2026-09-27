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
}

export const SIN_FILTRO: FiltroCatalogo = { plataforma: "", precio: "" }

type Item = { plataforma: string; precio: number }

const enRango = (precio: number, value: string) => {
    const r = RANGOS.find((x) => x.value === value)
    return !r || (precio > r.min && precio <= r.max)
}

export const pasaFiltro = (x: Item, f: FiltroCatalogo) => (!f.plataforma || x.plataforma === f.plataforma) && enRango(x.precio, f.precio)

interface FiltrosCatalogoProps {
    items: Item[]
    value: FiltroCatalogo
    onChange: (value: FiltroCatalogo) => void
    mobile?: boolean
}

/**
 * Plataforma y rango de precio junto al buscador de la tabla. Cada opción lleva en una pastilla cuántos productos quedarían con el
 * otro filtro ya aplicado (las que quedan en 0 se ven apagadas), así nunca se elige a ciegas un rango vacío.
 */
export default function FiltrosCatalogo({ items, value, onChange, mobile }: Readonly<FiltrosCatalogoProps>) {
    const porPrecio = items.filter((x) => enRango(x.precio, value.precio))
    const porPlataforma = items.filter((x) => !value.plataforma || x.plataforma === value.plataforma)

    const conteo = new Map<string, number>()
    for (const x of porPrecio) conteo.set(x.plataforma, (conteo.get(x.plataforma) ?? 0) + 1)
    // si la plataforma elegida queda en 0 con el rango actual, igual se lista para poder verla y cambiarla
    const nombres = [...new Set([...conteo.keys(), ...(value.plataforma ? [value.plataforma] : [])])].sort((a, b) => a.localeCompare(b, "es"))

    const plataformas = [
        { value: "", label: "Todas las plataformas", count: porPrecio.length },
        ...nombres.map((n) => ({ value: n, label: n, count: conteo.get(n) ?? 0 })),
    ]
    const precios = [
        { value: "", label: "Cualquier precio", count: porPlataforma.length },
        ...RANGOS.map((r) => ({ value: r.value, label: r.label, count: porPlataforma.filter((x) => enRango(x.precio, r.value)).length })),
    ]

    const activo = value.plataforma !== "" || value.precio !== ""

    return (
        <div className={mobile ? "grid grid-cols-2 gap-3" : "flex items-center gap-3"}>
            <div className={mobile ? "min-w-0" : "w-56"}>
                <SelectDropdown options={plataformas} value={value.plataforma} onChange={(plataforma) => onChange({ ...value, plataforma })} />
            </div>
            <div className={mobile ? "min-w-0" : "w-52"}>
                <SelectDropdown options={precios} value={value.precio} onChange={(precio) => onChange({ ...value, precio })} />
            </div>
            {activo && (
                <button
                    type="button"
                    onClick={() => onChange(SIN_FILTRO)}
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
