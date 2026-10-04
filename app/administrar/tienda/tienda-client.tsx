"use client"

import { useState, useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import Card from "@ui/card"
import Button from "@ui/button"
import { SearchInput } from "@ui/data-frame"
import { AlertCircle, RefreshCw, Wallet } from "lucide-react"
import ProductGrid from "@/app/administrar/tienda/product-grid"
import { FiltrosActivos, FiltrosCompactos, FiltrosPanel, SIN_FILTRO, hayFiltro, pasaFiltroTienda, type FiltroTienda } from "@/app/administrar/tienda/tienda-filtros"
import { TIPO_ACCESO } from "@/app/administrar/tienda/product-card"
import type { CatalogoDisponibleItem } from "@action/tienda/get-catalogo-disponible-action"
import { formatCOP } from "@lib/currency"
import { MAX_PERFILES_PEDIDO } from "@lib/pedido"
import PagoBrebModal from "@/app/administrar/tienda/pago-breb-modal"

interface TiendaClientProps {
    /** undefined = la página aún carga (loading.tsx) · null = error */
    initialCatalogo: CatalogoDisponibleItem[] | null | undefined
    /** Llave Bre-B a la que se paga (la configura el admin en Ajustes). "" = no configurada · undefined = aún carga. */
    llaveBreb: string | undefined
}

export default function TiendaClient({ initialCatalogo, llaveBreb }: TiendaClientProps) {
    const router = useRouter()
    const [reintentando, startReintento] = useTransition()
    // Sin copia en estado: tras "Reintentar" (router.refresh) llega el catálogo nuevo por props.
    const catalogo = initialCatalogo
    const [search, setSearch] = useState("")
    const [filtro, setFiltro] = useState<FiltroTienda>(SIN_FILTRO)
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    const [pagando, setPagando] = useState(false)

    // Primero el buscador; sobre lo que queda, los filtros cuentan cuántos productos dejaría cada opción.
    const porBusqueda = useMemo(() => {
        if (!catalogo) return []
        const term = search.trim().toLowerCase()
        if (term.length === 0) return catalogo
        return catalogo.filter((item) =>
            item.perfil_nombre.toLowerCase().includes(term) ||
            item.platform_nombre.toLowerCase().includes(term) ||
            TIPO_ACCESO[item.access_type].toLowerCase().includes(term))
    }, [catalogo, search])

    const visibleItems = useMemo(() => porBusqueda.filter((item) => pasaFiltroTienda(item, filtro)), [porBusqueda, filtro])

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

    const demasiados = selectedItems.length > MAX_PERFILES_PEDIDO
    const puedePagar = selectedItems.length > 0 && !!llaveBreb && !demasiados

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
        // Escritorio (xl): panel de filtros fijo a la izquierda y los productos a la derecha. Debajo de xl, filtros compactos arriba.
        <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[17rem_minmax(0,1fr)] xl:items-start xl:gap-6">
            <aside aria-label="Filtros" className="hidden xl:sticky xl:top-0 xl:block xl:max-h-[calc(100dvh-4rem)] xl:overflow-y-auto xl:rounded-2xl xl:[scrollbar-width:thin]">
                <Card padding="p-5">
                    <FiltrosPanel todos={catalogo} base={porBusqueda} value={filtro} onChange={setFiltro} />
                </Card>
            </aside>

            <div className="flex min-w-0 flex-col gap-4">
                <Card padding="p-4 sm:p-6" className="flex flex-col gap-4 xl:hidden">
                    {/* Mismo buscador que las tablas del panel. El Input de formularios reserva espacio para mensajes y descuadraba la fila. */}
                    <SearchInput value={search} onChange={setSearch} placeholder="Buscar por perfil o plataforma..." className="w-full" />
                    <FiltrosCompactos todos={catalogo} base={porBusqueda} visibles={visibleItems.length} value={filtro} onChange={setFiltro} />
                </Card>

                <div className="hidden flex-col gap-3 xl:flex">
                    <SearchInput value={search} onChange={setSearch} placeholder="Buscar por perfil o plataforma..." className="w-full" />
                    <FiltrosActivos todos={catalogo} visibles={visibleItems.length} value={filtro} onChange={setFiltro} />
                </div>

                <ProductGrid
                    items={catalogo === undefined ? undefined : visibleItems}
                    selectedIds={selectedIds}
                    onToggle={toggleSelected}
                    onLimpiar={search || hayFiltro(filtro) ? () => { setSearch(""); setFiltro(SIN_FILTRO) } : undefined}
                />

                <Card className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-sm text-secondary">
                        <p aria-live="polite">
                            {selectedItems.length} seleccionados · Total: <span className="text-white font-semibold">{formatCOP(total)}</span>
                        </p>
                        {llaveBreb === "" && (
                            <p className="mt-1 text-xs text-amber-400">
                                Los pagos no están disponibles en este momento. Contacta a soporte.
                            </p>
                        )}
                        {demasiados && (
                            <p className="mt-1 text-xs text-amber-400">Puedes pagar hasta {MAX_PERFILES_PEDIDO} perfiles por pedido.</p>
                        )}
                    </div>
                    <Button
                        variant="primary"
                        disabled={!puedePagar}
                        title={llaveBreb === "" ? "No hay una llave Bre-B configurada" : undefined}
                        leftIcon={<Wallet className="w-4 h-4" />}
                        onClick={() => setPagando(true)}
                    >
                        Pagar con Bre-B
                    </Button>
                </Card>

                {llaveBreb && (
                    <PagoBrebModal
                        isOpen={pagando}
                        onClose={() => setPagando(false)}
                        items={selectedItems}
                        total={total}
                        llave={llaveBreb}
                        onPedido={() => setSelectedIds(new Set())}
                    />
                )}
            </div>
        </div>
    )
}
