"use client"

import { Circle, CircleCheck } from "lucide-react"
import { formatCOP } from "@lib/currency"
import type { CatalogoDisponibleItem } from "@action/tienda/get-catalogo-disponible-action"

interface ProductCardProps {
    item: CatalogoDisponibleItem;
    selected: boolean;
    onToggle: () => void;
}

/** Tarjeta seleccionable: es un botón de alternar (aria-pressed), con el mismo aspecto que Card. */
export default function ProductCard({ item, selected, onToggle }: ProductCardProps) {
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-pressed={selected}
            className={`flex w-full cursor-pointer flex-col gap-2 rounded-2xl border p-6 text-left shadow-2xl backdrop-blur-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${selected ? "border-accent/40 bg-accent/5" : "border-white/6 bg-white/3 hover:bg-white/5"
                }`}
        >
            <span className="flex w-full items-start justify-between gap-2">
                <span className="text-xs text-secondary uppercase tracking-wide">
                    {item.platform_nombre} · {item.categoria}
                </span>
                {selected ? (
                    <CircleCheck className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
                ) : (
                    <Circle className="w-4 h-4 text-secondary shrink-0" aria-hidden="true" />
                )}
            </span>
            <span className="font-semibold text-white">{item.perfil_nombre}</span>
            <span className="text-sm text-accent font-medium">{formatCOP(item.precio_venta)}</span>
        </button>
    )
}

/** Tarjeta de carga: mismo marco y mismas tres líneas (h-4 text-xs · h-6 nombre · h-5 precio) que ProductCard. */
export function ProductCardSkeleton() {
    return (
        <div className="flex w-full flex-col gap-2 rounded-2xl border border-white/6 bg-white/3 p-6 shadow-2xl backdrop-blur-xl" aria-hidden="true">
            <div className="h-4 w-32 animate-pulse rounded-md bg-white/5" />
            <div className="h-6 w-40 animate-pulse rounded-md bg-white/5" />
            <div className="h-5 w-20 animate-pulse rounded-md bg-white/5" />
        </div>
    )
}
