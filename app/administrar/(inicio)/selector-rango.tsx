"use client"

import { RANGOS, type Rango } from "@lib/bodega/consumo"

/** Selector de rango de tiempo de las tarjetas del Dashboard (30 días / 90 días / 12 meses / Todo). */
export default function SelectorRango({ value, onChange }: Readonly<{ value: Rango; onChange: (r: Rango) => void }>) {
    return (
        <div role="radiogroup" aria-label="Rango de tiempo" className="flex shrink-0 rounded-xl border border-white/6 bg-white/3 p-1">
            {RANGOS.map((r) => (
                <button
                    key={r.value}
                    type="button"
                    role="radio"
                    aria-checked={value === r.value}
                    onClick={() => onChange(r.value)}
                    className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${value === r.value ? "bg-accent/15 text-accent" : "text-secondary hover:text-white"}`}
                >
                    {r.label}
                </button>
            ))}
        </div>
    )
}
