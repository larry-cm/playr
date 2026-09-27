"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Card from "@ui/card"
import Alert from "@ui/alert"
import Table from "@ui/table"
import { SectionHeader } from "@ui/page-header"
import { IconAction, MobileAction } from "@ui/data-frame"
import { AlertCircle, Package, ShoppingCart } from "lucide-react"
import SaldoCard from "@/app/administrar/bodega/saldo-card"
import ResumenBodegaCard from "@/app/administrar/bodega/resumen-card"
import HistorialCard from "@/app/administrar/bodega/historial-card"
import ComprarModal from "@/app/administrar/bodega/comprar-modal"
import FiltrosCatalogo, { pasaFiltro, SIN_FILTRO, type FiltroCatalogo } from "@/app/administrar/bodega/filtros-catalogo"
import { getSaldoProveedorAction } from "@action/manager-and-admin/bodega/get-saldo-action"
import { comprarBodegaAction } from "@action/manager-and-admin/bodega/comprar-action"
import { getPedidosProveedorAction, reintentarRegistroAction } from "@action/manager-and-admin/bodega/compras-action"
import { formatCOP } from "@lib/currency"
import { capitalizar } from "@lib/text"
import { duracionDe } from "@lib/bodega/duracion"
import type { BodegaCatalogo, BodegaProducto, PedidoRegistro, ResultadoCompraUI, SaldoProveedor } from "@lib/bodega/tipos"

interface BodegaClientProps {
    initialCatalogo: BodegaCatalogo | null
    /** BODEGA_SIMULAR=1 en el servidor: todo se verifica contra el proveedor, pero no se paga. */
    simulacion: boolean
}

type Fila = {
    id: number
    Producto: string
    Plataforma: string
    Duración: string
    Precio: string
    producto: BodegaProducto
}

const accesoLabel = (p: BodegaProducto) => (p.combo ? "Combo" : { completa: "Completa", pantalla: "Pantalla", otro: "Otro" }[p.access_type])

type Variante = "success" | "error" | "warning" | "info"
const varianteDe = (r: ResultadoCompraUI): Variante => (!r.ok ? "error" : r.nivel === "error" ? "success" : r.nivel)

/** "2026-09-20" -> "20/09/2026" a mano: new Date("2026-09-20") es medianoche UTC y en Colombia (UTC-5) mostraria el dia anterior. */
const fechaCorta = (iso: string) => iso.split("-").reverse().join("/")

/** Solo garantiza unicidad (es la llave de idempotencia de la compra), no secreto: por eso vale el respaldo sin crypto. */
const nuevoId = () =>
    globalThis.crypto?.randomUUID?.() ?? "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16))

export default function BodegaClient({ initialCatalogo, simulacion }: Readonly<BodegaClientProps>) {
    // undefined = cargando · null = error · objeto = leído
    const [saldo, setSaldo] = useState<SaldoProveedor | null | undefined>(undefined)
    const [pedidos, setPedidos] = useState<PedidoRegistro[] | null | undefined>(undefined)
    const [alert, setAlert] = useState<{ variant: Variante; message: string } | null>(null)

    const [comprando, setComprando] = useState<BodegaProducto | null>(null)
    const [modalError, setModalError] = useState<string | null>(null)
    const [isPending, setIsPending] = useState(false)
    const [registrandoId, setRegistrandoId] = useState<number | null>(null)
    const [filtro, setFiltro] = useState<FiltroCatalogo>(SIN_FILTRO)

    // Saldo y pedidos se leen en paralelo del sitio del proveedor (cada uno con su sesión): el saldo suele llegar antes.
    useEffect(() => {
        let active = true
        getSaldoProveedorAction().then((s) => {
            if (active) setSaldo(s)
        })
        getPedidosProveedorAction().then((p) => {
            if (active) setPedidos(p)
        })
        return () => {
            active = false
        }
    }, [])

    // Tras una compra o un registro se vuelven a leer solos (no hay botones de actualizar). Se deja lo que había a la vista
    // mientras llega lo nuevo, así las tarjetas no parpadean; si la relectura falla se conserva lo último leído.
    const refrescarSaldo = () => getSaldoProveedorAction().then((s) => s && setSaldo(s))
    const refrescarPedidos = () => getPedidosProveedorAction().then((p) => p && setPedidos(p))

    const filas = useMemo<Fila[]>(
        () =>
            (initialCatalogo?.productos ?? []).map((p) => ({
                id: p.listing_id,
                Producto: capitalizar(p.nombre),
                Plataforma: p.platform_nombre ? capitalizar(p.platform_nombre) : "Combo",
                Duración: duracionDe(p.nombre),
                Precio: formatCOP(p.precio),
                producto: p,
            })),
        [initialCatalogo],
    )
    const items = useMemo(() => filas.map((f) => ({ plataforma: f.Plataforma, precio: f.producto.precio })), [filas])
    const filasVisibles = useMemo(() => filas.filter((_, i) => pasaFiltro(items[i], filtro)), [filas, items, filtro])

    const abrirCompra = (p: BodegaProducto) => {
        setModalError(null)
        setAlert(null)
        setComprando(p)
    }

    const confirmarCompra = async (cantidad: number) => {
        if (!comprando || isPending) return
        setIsPending(true)
        setModalError(null)
        setAlert(null)

        let r: ResultadoCompraUI
        try {
            r = await comprarBodegaAction({ listing_id: comprando.listing_id, cantidad, precio: comprando.precio, request_id: nuevoId() })
        } catch {
            // Si la conexión se corta a mitad de camino la compra pudo haberse hecho: nunca decir "no se pagó" ni invitar a reintentar a ciegas.
            r = {
                ok: false,
                nivel: "error",
                estado: "incierta",
                mensaje: "No recibimos respuesta del servidor. La compra pudo haberse realizado: revisa el historial y el saldo antes de volver a intentar.",
            }
        }
        setIsPending(false)

        if (typeof r.saldo === "number") setSaldo({ saldo: r.saldo, leidoEn: new Date().toISOString() })
        else if (r.ok || r.estado === "incierta") refrescarSaldo()
        if (r.ok || r.estado) refrescarPedidos()

        if (!r.ok && r.precioActual !== undefined) {
            // el precio cambió en el proveedor: se muestra el nuevo para que el manager lo vuelva a confirmar
            setComprando({ ...comprando, precio: r.precioActual })
            setModalError(r.mensaje)
            return
        }
        if (!r.ok && r.estado !== "incierta") {
            setModalError(r.mensaje)
            return
        }
        setComprando(null)
        setAlert({ variant: varianteDe(r), message: r.mensaje })
    }

    const registrar = async (id: number) => {
        if (registrandoId !== null) return
        setRegistrandoId(id)
        setAlert(null)
        let r: ResultadoCompraUI
        try {
            r = await reintentarRegistroAction(id)
        } catch {
            r = { ok: false, nivel: "error", mensaje: "No recibimos respuesta del servidor. Revisa el historial e inténtalo de nuevo." }
        }
        setRegistrandoId(null)
        refrescarPedidos()
        setAlert({ variant: varianteDe(r), message: r.mensaje })
    }

    if (initialCatalogo === null) {
        return (
            <Card padding="px-4 py-12" className="flex flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400 mb-4 shadow-lg shadow-red-500/5">
                    <AlertCircle className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">Error al cargar la bodega</h3>
                <p className="text-sm text-white/60 max-w-md">
                    Tuvimos un problema al obtener la información. Por favor intenta de nuevo más tarde o verifica la conexión.
                </p>
            </Card>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            {simulacion && (
                <Alert
                    variant="info"
                    message="Modo simulación activo: las compras se verifican contra el proveedor pero NO se pagan. Se desactiva quitando BODEGA_SIMULAR del servidor."
                />
            )}
            {alert && <Alert variant={alert.variant} message={alert.message} onDismiss={() => setAlert(null)} />}

            {/* Arriba lo que se consulta primero: saldo y resumen a la izquierda, el registro global de pedidos a lo ancho del resto.
                Desde lg el registro va en absoluto: la fila la mide la columna izquierda (con su alto natural) y el registro la llena
                con scroll, así ni el resumen queda estirado con aire de sobra ni el registro sobresale. */}
            <div className="grid gap-4 lg:grid-cols-3">
                <div className="flex flex-col gap-4 md:flex-row lg:flex-col">
                    <div className="md:flex-1 lg:flex-none">
                        <SaldoCard saldo={saldo} />
                    </div>
                    <div className="md:flex-1">
                        <ResumenBodegaCard productosEnStock={initialCatalogo.productos.length} pedidos={pedidos} />
                    </div>
                </div>
                <div className="relative min-w-0 lg:col-span-2">
                    <div className="lg:absolute lg:inset-0">
                        <HistorialCard pedidos={pedidos} registrandoId={registrandoId} onRegistrar={registrar} />
                    </div>
                </div>
            </div>

            {/* Tabla genérica (app/ui/table.tsx) en solo lectura, con el encabezado dentro del marco y "Comprar" como acción de la fila. */}
            <Table
                header={["Producto", "Plataforma", "Duración", "Precio"]}
                data={filasVisibles}
                hideCreate
                builtinActions={[]}
                extraActions={(row, layout) => {
                    const Action = layout === "desktop" ? IconAction : MobileAction
                    return <Action icon={ShoppingCart} label="Comprar" title={`Comprar ${row.Producto}`} tone="accent" onClick={() => abrirCompra(row.producto)} />
                }}
                filters={(layout) => <FiltrosCatalogo items={items} value={filtro} onChange={setFiltro} mobile={layout === "mobile"} />}
                heading={
                    <SectionHeader
                        icon={Package}
                        title="Catálogo disponible"
                        description={
                            <>
                                Stock del último escaneo al proveedor{initialCatalogo.escaneo && ` · ${fechaCorta(initialCatalogo.escaneo)}`}. Al
                                comprar se verifica en vivo — fija el precio de venta en{" "}
                                <Link href="/administrar/productos" className="text-accent hover:underline">Productos</Link>.
                            </>
                        }
                    />
                }
            />

            {comprando && (
                <ComprarModal
                    key={comprando.listing_id}
                    producto={comprando}
                    accesoLabel={accesoLabel(comprando)}
                    saldo={saldo ? saldo.saldo : null}
                    pending={isPending}
                    error={modalError}
                    onConfirm={confirmarCompra}
                    onClose={() => setComprando(null)}
                />
            )}
        </div>
    )
}
