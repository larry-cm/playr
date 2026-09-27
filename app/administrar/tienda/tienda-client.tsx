"use client"

import { useState, useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import Card from "@ui/card"
import Button from "@ui/button"
import { SearchInput } from "@ui/data-frame"
import Select from "@ui/select"
import { AlertCircle, MessageCircle, RefreshCw } from "lucide-react"
import ProductGrid from "@/app/administrar/tienda/product-grid"
import type { CatalogoDisponibleItem } from "@action/tienda/get-catalogo-disponible-action"
import { formatCOP } from "@lib/currency"
import { whatsappAdvisorNumber } from "@lib/const"

// Número del asesor sin signos (wa.me solo acepta dígitos). Vacío = no configurado: no se puede pedir por WhatsApp.
const telefonoAsesor = (whatsappAdvisorNumber ?? "").replace(/\D/g, "")

export default function TiendaClient({ initialCatalogo }: { initialCatalogo: CatalogoDisponibleItem[] | null }) {
    const router = useRouter()
    const [reintentando, startReintento] = useTransition()
    // Sin copia en estado: tras "Reintentar" (router.refresh) llega el catálogo nuevo por props.
    const catalogo = initialCatalogo
    const [search, setSearch] = useState("")
    const [categoria, setCategoria] = useState("")
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

    const categorias = useMemo(() => {
        if (!catalogo) return []
        return Array.from(new Set(catalogo.map((item) => item.categoria))).sort()
    }, [catalogo])

    const visibleItems = useMemo(() => {
        if (!catalogo) return []
        const term = search.trim().toLowerCase()
        return catalogo.filter((item) => {
            const matchesSearch =
                term.length === 0 ||
                item.perfil_nombre.toLowerCase().includes(term) ||
                item.platform_nombre.toLowerCase().includes(term)
            const matchesCategoria = categoria.length === 0 || item.categoria === categoria
            return matchesSearch && matchesCategoria
        })
    }, [catalogo, search, categoria])

    const selectedItems = useMemo(() => {
        if (!catalogo) return []
        return catalogo.filter((item) => selectedIds.has(item.profile_id))
    }, [catalogo, selectedIds])

    const total = selectedItems.reduce((sum, item) => sum + item.precio_venta, 0)

    const toggleSelected = (profileId: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(profileId)) next.delete(profileId)
            else next.add(profileId)
            return next
        })
    }

    const hayAsesor = telefonoAsesor.length > 0
    const puedeEnviar = selectedItems.length > 0 && hayAsesor

    const lineasSeleccion = selectedItems
        .map((item, i) => `${i + 1}. ${item.platform_nombre} - ${item.perfil_nombre} - ${formatCOP(item.precio_venta)}`)
        .join("\n")

    const mensaje = `Hola, quiero contratar estos perfiles:\n\n${lineasSeleccion}\n\nTotal: ${formatCOP(total)}`

    const whatsappUrl = `https://wa.me/${telefonoAsesor}?text=${encodeURIComponent(mensaje)}`

    if (catalogo === null) {
        return (
            <Card padding="px-4 py-12" className="flex flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400 mb-4 shadow-lg shadow-red-500/5">
                    <AlertCircle className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">
                    Error al cargar la tienda
                </h3>
                <p className="text-sm text-white/60 max-w-md">
                    Tuvimos un problema al obtener la información. Verifica la conexión e inténtalo de nuevo.
                </p>
                <Button variant="secondary" className="mt-4" isLoading={reintentando} onClick={() => startReintento(() => router.refresh())} leftIcon={<RefreshCw className="h-4 w-4" />}>
                    Reintentar
                </Button>
            </Card>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Mismo buscador que las tablas del panel. El Input de formularios reserva espacio para mensajes y descuadraba la fila. */}
                <SearchInput value={search} onChange={setSearch} placeholder="Buscar por perfil o plataforma..." className="flex-1" />
                <div className="sm:w-56">
                    {/* allowEmpty: "Todas las categorías" es una opción elegible para quitar el filtro. */}
                    <Select
                        aria-label="Filtrar por categoría"
                        placeholder="Todas las categorías"
                        allowEmpty
                        value={categoria}
                        onChange={(e) => setCategoria(e.target.value)}
                        options={categorias.map((c) => ({ value: c, label: c }))}
                    />
                </div>
            </div>

            <ProductGrid
                items={visibleItems}
                selectedIds={selectedIds}
                onToggle={toggleSelected}
            />

            <Card className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-sm text-secondary">
                    <p aria-live="polite">
                        {selectedItems.length} seleccionados · Total: <span className="text-white font-semibold">{formatCOP(total)}</span>
                    </p>
                    {!hayAsesor && (
                        <p className="mt-1 text-xs text-amber-400">
                            Los pedidos por WhatsApp no están disponibles en este momento. Contacta a soporte desde el inicio.
                        </p>
                    )}
                </div>
                <Button
                    variant="primary"
                    disabled={!puedeEnviar}
                    title={hayAsesor ? undefined : "No hay un número de asesor configurado"}
                    leftIcon={<MessageCircle className="w-4 h-4" />}
                    onClick={() => {
                        if (puedeEnviar) {
                            window.open(whatsappUrl, "_blank", "noopener,noreferrer")
                        }
                    }}
                >
                    Pedir por WhatsApp
                </Button>
            </Card>
        </div>
    )
}
