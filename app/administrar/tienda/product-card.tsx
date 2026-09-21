"use client"

import Card from "@ui/card"
import { Circle, CircleCheck } from "lucide-react"
import { formatCOP } from "@lib/currency"
import type { CatalogoDisponibleItem } from "@action/tienda/get-catalogo-disponible-action"

interface ProductCardProps {
    item: CatalogoDisponibleItem;
    selected: boolean;
    onToggle: () => void;
}

export default function ProductCard({ item, selected, onToggle }: ProductCardProps) {
    return (
        <button type="button" onClick={onToggle} className="text-left w-full">
            <Card
                className={`flex flex-col gap-2 transition-colors ${selected ? "border-accent/40 bg-accent/5" : "hover:bg-white/5"
                    }`}
            >
                <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-secondary uppercase tracking-wide">
                        {item.platform_nombre} · {item.categoria}
                    </p>
                    {selected ? (
                        <CircleCheck className="w-4 h-4 text-accent shrink-0" />
                    ) : (
                        <Circle className="w-4 h-4 text-secondary shrink-0" />
                    )}
                </div>
                <p className="font-semibold text-white">{item.perfil_nombre}</p>
                <p className="text-sm text-accent font-medium">{formatCOP(item.precio_venta)}</p>
            </Card>
        </button>
    )
}
