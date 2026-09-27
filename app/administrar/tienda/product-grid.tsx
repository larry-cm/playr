"use client"

import Card from "@ui/card"
import ProductCard, { ProductCardSkeleton } from "@/app/administrar/tienda/product-card"
import type { CatalogoDisponibleItem } from "@action/tienda/get-catalogo-disponible-action"

interface ProductGridProps {
    /** undefined = la página aún carga: tarjetas de carga con la misma forma que las reales */
    items: CatalogoDisponibleItem[] | undefined;
    selectedIds: Set<number>;
    onToggle: (profileId: number) => void;
}

export default function ProductGrid({ items, selectedIds, onToggle }: ProductGridProps) {
    if (items === undefined) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }, (_, i) => <ProductCardSkeleton key={i} />)}
            </div>
        )
    }

    if (items.length === 0) {
        return (
            <Card padding="px-4 py-12" className="flex flex-col items-center justify-center text-center">
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
