"use client"

import { useState, useMemo } from "react"
import Card from "@ui/card"
import Button from "@ui/button"
import Input from "@ui/input"
import Select from "@ui/select"
import { AlertCircle, Search, MessageCircle } from "lucide-react"
import ProductGrid from "@/app/administrar/tienda/product-grid"
import type { CatalogoDisponibleItem } from "@action/tienda/get-catalogo-disponible-action"
import { formatCOP } from "@lib/currency"
import { whatsappAdvisorNumber } from "@lib/const"

export default function TiendaClient({ initialCatalogo }: { initialCatalogo: CatalogoDisponibleItem[] | null }) {
    const [catalogo] = useState<CatalogoDisponibleItem[] | null>(initialCatalogo)
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

    const puedeEnviar = selectedItems.length > 0

    const lineasSeleccion = selectedItems
        .map((item, i) => `${i + 1}. ${item.platform_nombre} - ${item.perfil_nombre} - ${formatCOP(item.precio_venta)}`)
        .join("\n")

    const mensaje = `Hola, quiero contratar estos perfiles:\n\n${lineasSeleccion}\n\nTotal: ${formatCOP(total)}`

    const telefonoAsesor = (whatsappAdvisorNumber ?? "").replace(/\D/g, "")
    const whatsappUrl = `https://wa.me/${telefonoAsesor}?text=${encodeURIComponent(mensaje)}`

    if (catalogo === null) {
        return (
            <Card className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400 mb-4 shadow-lg shadow-red-500/5">
                    <AlertCircle className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">
                    Error al cargar la tienda
                </h3>
                <p className="text-sm text-white/60 max-w-md">
                    Tuvimos un problema al obtener la información. Por favor intenta de nuevo más tarde o verifica la conexión.
                </p>
            </Card>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                    <Input
                        placeholder="Buscar por perfil o plataforma..."
                        leftIcon={<Search className="w-4 h-4" />}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="sm:w-56">
                    <Select
                        placeholder="Todas las categorías"
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
                <p className="text-sm text-secondary">
                    {selectedItems.length} seleccionados · Total: <span className="text-white font-semibold">{formatCOP(total)}</span>
                </p>
                <Button
                    variant="primary"
                    disabled={!puedeEnviar}
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
