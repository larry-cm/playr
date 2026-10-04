"use client"

import { X } from "lucide-react"
import Card from "@ui/card"
import Button from "@ui/button"
import ProductCard, { ProductCardSkeleton } from "@/app/administrar/tienda/product-card"
import type { CatalogoDisponibleItem } from "@action/tienda/get-catalogo-disponible-action"

interface ProductGridProps {
    /** undefined = la página aún carga: tarjetas de carga con la misma forma que las reales */
    items: CatalogoDisponibleItem[] | undefined;
    selectedIds: Set<number>;
    onToggle: (profileId: number) => void;
    /** Si hay búsqueda o filtros activos: el vacío ofrece quitarlos en vez de dejar al cliente sin salida. */
    onLimpiar?: () => void;
}

export default function ProductGrid({ items, selectedIds, onToggle, onLimpiar }: ProductGridProps) {
    if (items === undefined) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }, (_, i) => <ProductCardSkeleton key={i} />)}
            </div>
        )
    }

    if (items.length === 0) {
        return (
            <Card padding="px-4 py-12" className="flex flex-col items-center justify-center text-center">
                <p className="text-sm text-secondary">No se encontraron productos.</p>
                {onLimpiar && (
                    <Button variant="secondary" className="mt-4" onClick={onLimpiar} leftIcon={<X className="h-4 w-4" />}>
                        Limpiar filtros
                    </Button>
                )}
            </Card>
        )
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
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
