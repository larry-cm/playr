"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Card from "@ui/card"
import Alert from "@ui/alert"
import Table from "@ui/table"
import { AlertCircle, ShoppingCart } from "lucide-react"
import SaldoCard from "@/app/administrar/bodega/saldo-card"
import HistorialCard from "@/app/administrar/bodega/historial-card"
import ComprarModal from "@/app/administrar/bodega/comprar-modal"
import { getSaldoProveedorAction } from "@action/manager-and-admin/bodega/get-saldo-action"
import { comprarBodegaAction } from "@action/manager-and-admin/bodega/comprar-action"
import { getComprasBodegaAction, reintentarRegistroAction } from "@action/manager-and-admin/bodega/compras-action"
import { formatCOP } from "@lib/currency"
import type { BodegaCatalogo, BodegaProducto, CompraHistorial, ResultadoCompraUI, SaldoProveedor } from "@lib/bodega/tipos"

interface BodegaClientProps {
    initialCatalogo: BodegaCatalogo | null
    initialCompras: CompraHistorial[] | null
    /** BODEGA_SIMULAR=1 en el servidor: todo se verifica contra el proveedor, pero no se paga. */
    simulacion: boolean
}

type Fila = {
    id: number
    Producto: string
    Plataforma: string
    Acceso: string
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

export default function BodegaClient({ initialCatalogo, initialCompras, simulacion }: Readonly<BodegaClientProps>) {
    // undefined = cargando · null = error · objeto = leído
    const [saldo, setSaldo] = useState<SaldoProveedor | null | undefined>(undefined)
    const [compras, setCompras] = useState<CompraHistorial[] | null>(initialCompras)
    const [alert, setAlert] = useState<{ variant: Variante; message: string } | null>(null)

    const [comprando, setComprando] = useState<BodegaProducto | null>(null)
    const [modalError, setModalError] = useState<string | null>(null)
    const [isPending, setIsPending] = useState(false)
    const [registrandoId, setRegistrandoId] = useState<number | null>(null)

    useEffect(() => {
        let active = true
        getSaldoProveedorAction().then((s) => {
            if (active) setSaldo(s)
        })
        return () => {
            active = false
        }
    }, [])

    const refrescarSaldo = () => {
        setSaldo(undefined)
        getSaldoProveedorAction().then(setSaldo)
    }
    const refrescarCompras = () => getComprasBodegaAction().then((c) => c && setCompras(c))

    const filas = useMemo<Fila[]>(
        () =>
            (initialCatalogo?.productos ?? []).map((p) => ({
                id: p.listing_id,
                Producto: p.nombre,
                Plataforma: p.platform_nombre ?? "Combo",
                Acceso: accesoLabel(p),
                Precio: formatCOP(p.precio),
                producto: p,
            })),
        [initialCatalogo],
    )

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
        if (r.ok || r.estado) refrescarCompras()

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
        refrescarCompras()
        setAlert({ variant: varianteDe(r), message: r.mensaje })
    }

    if (initialCatalogo === null) {
        return (
            <Card className="flex flex-col items-center justify-center py-12 px-4 text-center">
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

            <SaldoCard saldo={saldo} onRefresh={refrescarSaldo} />

            <div className="flex flex-col gap-2">
                <p className="text-sm text-secondary">
                    Productos que el proveedor tenía en stock en su último escaneo
                    {initialCatalogo.escaneo && ` (${fechaCorta(initialCatalogo.escaneo)})`}. Al comprar se vuelve a verificar en vivo. Lo
                    comprado queda en el inventario; fija su precio de venta en <Link href="/administrar/productos" className="text-accent hover:underline">Productos</Link>.
                </p>
                {/* Mismo componente y marco que Clientes; aquí solo lectura, con "Comprar" como acción de la fila. */}
                <Table
                    header={["Producto", "Plataforma", "Acceso", "Precio"]}
                    data={filas}
                    hideCreate
                    builtinActions={[]}
                    extraActions={(row, layout) => (
                        <button
                            type="button"
                            onClick={() => abrirCompra(row.producto)}
                            aria-label={`Comprar ${row.Producto}`}
                            title="Comprar"
                            className={
                                layout === "desktop"
                                    ? "flex h-9 w-9 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-(--color-accent) transition-all duration-200 hover:bg-accent/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
                                    : "inline-flex h-9 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 px-3 text-sm text-(--color-accent) transition-all duration-200 hover:bg-accent/20"
                            }
                        >
                            <ShoppingCart className={layout === "desktop" ? "h-4 w-4" : "mr-2 h-4 w-4"} />
                            {layout === "mobile" && "Comprar"}
                        </button>
                    )}
                />
            </div>

            <HistorialCard compras={compras} registrandoId={registrandoId} onRegistrar={registrar} />

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
