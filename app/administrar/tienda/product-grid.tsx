"use client"

import Card from "@ui/card"
import ProductCard from "@/app/administrar/tienda/product-card"
import type { CatalogoDisponibleItem } from "@action/tienda/get-catalogo-disponible-action"

interface ProductGridProps {
    items: CatalogoDisponibleItem[];
    selectedIds: Set<number>;
    onToggle: (profileId: number) => void;
}

export default function ProductGrid({ items, selectedIds, onToggle }: ProductGridProps) {
    if (items.length === 0) {
        return (
            <Card className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <p className="text-sm text-secondary">No se encontraron productos.</p>
            </Card>
        )
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
                <ProductCard
                    key={item.profile_id}
                    item={item}
                    selected={selectedIds.has(item.profile_id)}
                    onToggle={() => onToggle(item.profile_id)}
                />
            ))}
        </div>
    )
}
