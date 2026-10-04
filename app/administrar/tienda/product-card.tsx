"use client"

import { Circle, CircleCheck, Monitor, Package, UserRound, Users } from "lucide-react"
import { formatCOP } from "@lib/currency"
import { marca } from "@lib/marcas"
import PlatformEmblem from "@ui/platform-emblem"
import type { CatalogoDisponibleItem } from "@action/tienda/get-catalogo-disponible-action"

interface ProductCardProps {
    item: CatalogoDisponibleItem;
    selected: boolean;
    onToggle: () => void;
}

/** Perfiles que se dibujan en la imagen: una pantalla enciende uno, una cuenta completa los enciende todos. */
const PERFILES = 5

/** Qué se compra, en texto: lo usan la tarjeta y el mensaje de WhatsApp. */
export const TIPO_ACCESO: Record<CatalogoDisponibleItem["access_type"], string> = {
    completa: "Cuenta completa",
    pantalla: "Pantalla",
    otro: "Producto",
}

const DETALLE_ACCESO: Record<CatalogoDisponibleItem["access_type"], string> = {
    completa: "Todos los perfiles de la cuenta son tuyos",
    pantalla: "Un perfil de una cuenta compartida",
    otro: "Acceso según el producto",
}

/**
 * Imagen del producto: el emblema de la plataforma sobre un fondo de su color y, debajo, los perfiles de la cuenta.
 * Pantalla = un perfil encendido y los demás apagados; cuenta completa = todos encendidos. Es decorativa: el texto de la tarjeta dice lo mismo.
 */
function ProductImage({ item }: { item: CatalogoDisponibleItem }) {
    const { color } = marca(item.platform_nombre)
    const encendidos = item.access_type === "completa" ? PERFILES : item.access_type === "pantalla" ? 1 : 0
    const TipoIcon = item.access_type === "completa" ? Users : item.access_type === "pantalla" ? Monitor : Package

    return (
        <span
            className="relative flex aspect-video w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-xl border border-white/6"
            style={{
                background: `radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, ${color} 32%, transparent), transparent 70%), #0d0d12`,
            }}
            aria-hidden="true"
        >
            <PlatformEmblem platform={item.platform_nombre} size={44} />

            {encendidos > 0 ? (
                <span className="flex items-center gap-1.5">
                    {Array.from({ length: PERFILES }, (_, i) => {
                        const on = i < encendidos
                        return (
                            <span
                                key={i}
                                className="flex h-7 w-7 items-center justify-center rounded-full border"
                                style={
                                    on
                                        ? { backgroundColor: `color-mix(in srgb, ${color} 85%, black)`, borderColor: color, color: "#fff" }
                                        : { borderColor: "rgb(255 255 255 / 0.1)", color: "rgb(255 255 255 / 0.2)" }
                                }
                            >
                                <UserRound className="h-4 w-4" />
                            </span>
                        )
                    })}
                </span>
            ) : (
                <Package className="h-7 w-7 text-white/40" />
            )}

            <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
                <TipoIcon className="h-3.5 w-3.5" />
                {TIPO_ACCESO[item.access_type]}
            </span>
        </span>
    )
}

/** Tarjeta seleccionable: es un botón de alternar (aria-pressed), con el mismo aspecto que Card. */
export default function ProductCard({ item, selected, onToggle }: ProductCardProps) {
    const { nombre } = marca(item.platform_nombre)

    return (
        <button
            type="button"
            onClick={onToggle}
            aria-pressed={selected}
            className={`relative flex w-full cursor-pointer flex-col gap-3 rounded-2xl border p-3 text-left shadow-2xl backdrop-blur-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${selected ? "border-accent/40 bg-accent/5" : "border-white/6 bg-white/3 hover:bg-white/5"
                }`}
        >
            <ProductImage item={item} />
            <span className="absolute top-5 right-5 rounded-full bg-black/50 p-1 backdrop-blur">
                {selected ? (
                    <CircleCheck className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
                ) : (
                    <Circle className="w-4 h-4 text-white/60 shrink-0" aria-hidden="true" />
                )}
            </span>

            <span className="flex flex-col gap-1 px-2 pb-2">
                <span className="text-xs text-secondary uppercase tracking-wide">{item.categoria}</span>
                <span className="font-semibold text-white">
                    {item.access_type === "otro" ? nombre : `${nombre} · ${TIPO_ACCESO[item.access_type]}`}
                </span>
                <span className="text-xs text-secondary">
                    {DETALLE_ACCESO[item.access_type]} · {item.perfil_nombre}
                </span>
                <span className="text-sm text-accent font-medium">{formatCOP(item.precio_venta)}</span>
            </span>
        </button>
    )
}

/** Tarjeta de carga: mismo marco, misma imagen 16:9 y mismas cuatro líneas (h-4 · h-6 · h-4 · h-5) que ProductCard. */
export function ProductCardSkeleton() {
    return (
        <div className="flex w-full flex-col gap-3 rounded-2xl border border-white/6 bg-white/3 p-3 shadow-2xl backdrop-blur-xl" aria-hidden="true">
            <div className="aspect-video w-full animate-pulse rounded-xl bg-white/5" />
            <div className="flex flex-col gap-1 px-2 pb-2">
                <div className="h-4 w-28 animate-pulse rounded-md bg-white/5" />
                <div className="h-6 w-44 animate-pulse rounded-md bg-white/5" />
                <div className="h-4 w-52 animate-pulse rounded-md bg-white/5" />
                <div className="h-5 w-20 animate-pulse rounded-md bg-white/5" />
            </div>
        </div>
    )
}
