"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRuta } from "@/app/administrar/sesion-tab"
import Card from "@ui/card"
import Alert from "@ui/alert"
import Button from "@ui/button"
import Table from "@ui/table"
import { SectionHeader } from "@ui/page-header"
import { IconAction, MobileAction } from "@ui/data-frame"
import { AlertCircle, Package, RefreshCw, ShoppingCart, TriangleAlert } from "lucide-react"
import SaldoCard from "@/app/administrar/bodega/saldo-card"
import ResumenBodegaCard from "@/app/administrar/bodega/resumen-card"
import HistorialCard, { HISTORIAL_ID } from "@/app/administrar/bodega/historial-card"
import ComprarModal from "@/app/administrar/bodega/comprar-modal"
import FiltrosCatalogo, { pasaFiltro, SIN_FILTRO, type FiltroCatalogo } from "@/app/administrar/bodega/filtros-catalogo"
import { getSaldoProveedorAction } from "@action/manager-and-admin/bodega/get-saldo-action"
import { comprarBodegaAction } from "@action/manager-and-admin/bodega/comprar-action"
import { getHistorialAction, sincronizarHistorialAction } from "@action/manager-and-admin/bodega/historial-action"
import { consultarProductoBodegaAction } from "@action/manager-and-admin/bodega/consultar-producto-action"
import { formatCOP } from "@lib/currency"
import { formatColombianDateTime, formatDateOnly } from "@lib/date"
import { capitalizar } from "@lib/text"
import { duracionDe } from "@lib/bodega/duracion"
import type { BodegaCatalogo, BodegaProducto, ConsultaEnVivo, HistorialProveedor, ResultadoCompraUI, SaldoProveedor } from "@lib/bodega/tipos"

interface BodegaClientProps {
    /** undefined = la página aún carga (loading.tsx): esqueleto y nada se lee del proveedor · null = error */
    initialCatalogo: BodegaCatalogo | null | undefined
    /** Registro de compras guardado en la base (llega con la página) · undefined = cargando · null = no se pudo leer */
    initialHistorial: HistorialProveedor | null | undefined
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

/** Una intención de compra: nace al abrir el modal y conserva su request_id (llave de idempotencia) en cada reintento. */
interface Intencion {
    /** El producto con el precio vigente que se conoce (el del escaneo, o el que informó el servidor al rechazar por cambio de precio). */
    producto: BodegaProducto
    requestId: string
    /** Precio del último escaneo del cron, para avisar si el de ahora es distinto. */
    precioEscaneo: number
    /** Lectura en vivo de precio, stock y saldo (solo lectura en el proveedor). */
    vivo: ConsultaEnVivo | "cargando"
}

/** Compra con resultado dudoso: puede haberse pagado. Bloquea volver a comprar ese producto hasta revisar el registro. */
interface CompraIncierta {
    listingId: number
    nombre: string
    mensaje: string
    /** El registro de pedidos se sincronizó con el proveedor DESPUÉS de la compra dudosa. */
    registroLeido: boolean
}

const accesoLabel = (p: BodegaProducto) => (p.combo ? "Combo" : { completa: "Completa", pantalla: "Pantalla", otro: "Otro" }[p.access_type])

type Variante = "success" | "error" | "warning" | "info"
const varianteDe = (r: ResultadoCompraUI): Variante => (!r.ok ? "error" : r.nivel === "error" ? "success" : r.nivel)

/** "dd/mm/aaaa, hh:mm" (hora de Colombia) si se conoce la hora del escaneo; solo la fecha en las corridas viejas, que no la guardaron. */
const textoEscaneo = (c: BodegaCatalogo) => (c.escaneoEn ? formatColombianDateTime(c.escaneoEn) : c.escaneo ? formatDateOnly(c.escaneo) : null)

/** El registro guardado se sincroniza solo si la última sincronización tiene más de esto (o nunca se hizo). */
const SYNC_CADA_MS = 24 * 60 * 60 * 1000
const desactualizado = (h: HistorialProveedor | null) => !h?.sincronizadoEn || Date.now() - Date.parse(h.sincronizadoEn) > SYNC_CADA_MS

/** Solo garantiza unicidad (es la llave de idempotencia de la compra), no secreto: por eso vale el respaldo sin crypto. */
const nuevoId = () =>
    globalThis.crypto?.randomUUID?.() ?? "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16))

export default function BodegaClient({ initialCatalogo, initialHistorial, simulacion }: Readonly<BodegaClientProps>) {
    const ruta = useRuta()
    // undefined = cargando · null = error · objeto = leído
    const [saldo, setSaldo] = useState<SaldoProveedor | null | undefined>(undefined)
    const [historial, setHistorial] = useState<HistorialProveedor | null | undefined>(initialHistorial)
    const [sincronizando, setSincronizando] = useState(false)
    const [errorSync, setErrorSync] = useState(false)
    const [alert, setAlert] = useState<{ variant: Variante; message: string } | null>(null)

    const [intencion, setIntencion] = useState<Intencion | null>(null)
    const [incierta, setIncierta] = useState<CompraIncierta | null>(null)
    const [modalError, setModalError] = useState<string | null>(null)
    const [isPending, setIsPending] = useState(false)
    const [filtro, setFiltro] = useState<FiltroCatalogo>(SIN_FILTRO)

    const cargando = initialCatalogo === undefined

    /**
     * Lee todos los pedidos del sitio del proveedor y los fusiona con lo guardado (lento). Mientras tanto se siguen viendo los pedidos
     * guardados; si falla se conservan y solo se marca el error. Devuelve si salió bien. Si ya hay una en curso (la automática, el
     * botón o la de una compra dudosa) se espera esa en vez de leer el sitio dos veces.
     */
    const syncEnCurso = useRef<Promise<boolean> | null>(null)
    const sincronizar = () =>
        (syncEnCurso.current ??= (async () => {
            setSincronizando(true)
            const h = await sincronizarHistorialAction().catch(() => null)
            syncEnCurso.current = null
            setSincronizando(false)
            setErrorSync(h === null)
            if (h) setHistorial(h)
            return h !== null
        })())

    // El registro llega guardado con la página. El saldo siempre se lee del proveedor; recién después (las server actions de un
    // mismo cliente corren una tras otra) se sincroniza el registro, solo si la última sincronización tiene más de un día.
    useEffect(() => {
        if (cargando) return
        let active = true
        getSaldoProveedorAction()
            .catch(() => null)
            .then((s) => {
                if (!active) return
                setSaldo(s)
                if (desactualizado(initialHistorial ?? null)) void sincronizar()
            })
        return () => {
            active = false
        }
        // solo al montar: initialHistorial es el de la carga de la página
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cargando])

    // Tras una compra se vuelve a leer el saldo. Se deja lo que había a la vista mientras llega lo nuevo, así la tarjeta no
    // parpadea; si la relectura falla se conserva lo último leído.
    const refrescarSaldo = async () => {
        const s = await getSaldoProveedorAction().catch(() => null)
        if (s) setSaldo(s)
    }
    /** Relee el registro guardado (rápido): la compra pagada ya agregó su pedido en el servidor. */
    const refrescarHistorial = async () => {
        const h = await getHistorialAction().catch(() => null)
        if (h) setHistorial(h)
    }

    /** "Reintentar" del saldo en error: aquí sí se muestra el esqueleto mientras se vuelve a leer. */
    const reintentarSaldo = () => {
        setSaldo(undefined)
        getSaldoProveedorAction().then(setSaldo, () => setSaldo(null))
    }

    /** Sincroniza tras una compra dudosa; recién entonces se puede confirmar que se revisó. */
    const releerRegistro = async () => {
        const ok = await sincronizar()
        if (ok) setIncierta((prev) => (prev ? { ...prev, registroLeido: true } : prev))
        document.getElementById(HISTORIAL_ID)?.scrollIntoView({ behavior: "smooth", block: "start" })
    }

    // Primera sincronización de una cuenta sin nada guardado: esqueleto en vez de "no tiene pedidos" (y error si falla).
    const primeraVez = historial?.sincronizadoEn === null && historial.pedidos.length === 0
    const pedidos =
        historial === undefined || (primeraVez && sincronizando) ? undefined : historial === null || (primeraVez && errorSync) ? null : historial.pedidos

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
    const items = useMemo(() => filas.map((f) => ({ plataforma: f.Plataforma, precio: f.producto.precio, duracion: f.Duración })), [filas])
    const filasVisibles = useMemo(() => filas.filter((_, i) => pasaFiltro(items[i], filtro)), [filas, items, filtro])

    const bloqueado = (p: BodegaProducto) => incierta?.listingId === p.listing_id

    // Token de la lectura en vivo vigente: al cerrar el modal, abrir otro producto o reintentar cambia, y la respuesta vieja se descarta.
    const consultaActual = useRef<string | null>(null)

    /** Lee en vivo precio, stock y saldo del producto (sin tocar el carrito del proveedor). */
    const verificarEnVivo = (listingId: number) => {
        const token = nuevoId()
        consultaActual.current = token
        setIntencion((prev) => (prev ? { ...prev, vivo: "cargando" } : prev))
        consultarProductoBodegaAction(listingId)
            .catch((): ConsultaEnVivo => ({ ok: false, error: "No recibimos respuesta del servidor." }))
            .then((vivo) => {
                if (consultaActual.current !== token) return
                setIntencion((prev) => (prev && prev.producto.listing_id === listingId ? { ...prev, vivo } : prev))
                if (vivo.ok) setSaldo({ saldo: vivo.saldo, leidoEn: vivo.leidoEn })
            })
    }

    const cerrarCompra = () => {
        consultaActual.current = null
        setIntencion(null)
    }

    const abrirCompra = (p: BodegaProducto) => {
        if (bloqueado(p)) return
        setModalError(null)
        setAlert(null)
        setIntencion({ producto: p, requestId: nuevoId(), precioEscaneo: p.precio, vivo: "cargando" })
        verificarEnVivo(p.listing_id)
    }

    /** `precio` es el precio unitario que el modal le mostró al manager (el verificado en vivo si se pudo leer): el servidor lo exige igual al de ahora. */
    const confirmarCompra = async (cantidad: number, precio: number) => {
        if (!intencion || isPending) return
        const { producto, requestId } = intencion
        setIsPending(true)
        setModalError(null)
        setAlert(null)

        let r: ResultadoCompraUI
        try {
            r = await comprarBodegaAction({ listing_id: producto.listing_id, cantidad, precio, request_id: requestId })
        } catch {
            // Si la conexión se corta a mitad de camino la compra pudo haberse hecho: nunca decir "no se pagó" ni invitar a reintentar a ciegas.
            r = {
                ok: false,
                nivel: "error",
                estado: "incierta",
                mensaje: "No recibimos respuesta del servidor. La compra pudo haberse realizado: revisa el registro de compras y el saldo antes de volver a intentar.",
            }
        }
        setIsPending(false)

        if (typeof r.saldo === "number") setSaldo({ saldo: r.saldo, leidoEn: new Date().toISOString() })
        else if (r.ok || r.estado === "incierta") void refrescarSaldo()

        if (r.estado === "incierta") {
            // Puede haberse pagado: aviso fijo (no un error que se descarta) y ese producto queda bloqueado hasta revisar el registro.
            cerrarCompra()
            setIncierta({ listingId: producto.listing_id, nombre: capitalizar(producto.nombre), mensaje: r.mensaje, registroLeido: false })
            void sincronizar().then((ok) => {
                if (ok) setIncierta((prev) => (prev && prev.listingId === producto.listing_id ? { ...prev, registroLeido: true } : prev))
            })
            return
        }
        if (r.ok && !r.simulado) void refrescarHistorial()

        if (!r.ok) {
            const precioActual = r.precioActual
            setIntencion((prev) =>
                prev && {
                    ...prev,
                    // el precio cambió en el proveedor: se muestra el nuevo (también como el verificado en vivo) para que el manager lo vuelva a confirmar
                    producto: precioActual !== undefined ? { ...prev.producto, precio: precioActual } : prev.producto,
                    vivo: precioActual !== undefined && prev.vivo !== "cargando" && prev.vivo.ok ? { ...prev.vivo, precio: precioActual } : prev.vivo,
                    // "fallida" = el servidor ya registró (y cerró) ese request_id: reusarlo respondería "ya fue procesada".
                    // Cualquier otro rechazo es previo al registro y el mismo intento conserva su llave.
                    requestId: r.estado === "fallida" ? nuevoId() : requestId,
                },
            )
            setModalError(r.mensaje)
            return
        }
        cerrarCompra()
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
                    Tuvimos un problema al obtener la información. Verifica la conexión y recarga la página.
                </p>
                <Button variant="secondary" className="mt-4" onClick={() => window.location.reload()} leftIcon={<RefreshCw className="h-4 w-4" />}>
                    Reintentar
                </Button>
            </Card>
        )
    }

    const escaneo = initialCatalogo ? textoEscaneo(initialCatalogo) : null

    return (
        <div className="flex flex-col gap-4">
            {simulacion && (
                <Alert
                    variant="info"
                    message="Modo simulación activo: las compras se verifican contra el proveedor pero NO se pagan. Se desactiva quitando BODEGA_SIMULAR del servidor."
                />
            )}
            {incierta && (
                <div role="alert" className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 sm:flex-row sm:items-center">
                    <TriangleAlert className="h-5 w-5 shrink-0 text-amber-400" aria-hidden="true" />
                    <div className="flex-1">
                        <p className="font-medium text-amber-200">No sabemos si la compra de {incierta.nombre} se pagó.</p>
                        <p className="mt-0.5">
                            {incierta.mensaje} Mientras tanto no se puede volver a comprar este producto.
                            {!incierta.registroLeido && " Primero sincroniza el registro de compras con el proveedor."}
                        </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                        <Button variant="secondary" size="sm" onClick={releerRegistro} isLoading={sincronizando} leftIcon={<RefreshCw className="h-4 w-4" />}>
                            Ver registro de compras
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!incierta.registroLeido}
                            title={incierta.registroLeido ? undefined : "Disponible cuando el registro de compras se haya sincronizado con el proveedor"}
                            onClick={() => setIncierta(null)}
                        >
                            Ya lo revisé
                        </Button>
                    </div>
                </div>
            )}
            {alert && (
                <Alert
                    variant={alert.variant}
                    message={alert.message}
                    onDismiss={() => setAlert(null)}
                    autoDismissMs={alert.variant === "success" ? 8000 : undefined}
                />
            )}

            {/* Arriba lo que se consulta primero: saldo y resumen a la izquierda, el registro global de pedidos a lo ancho del resto.
                Desde lg el registro va en absoluto: la fila la mide la columna izquierda (con su alto natural) y el registro la llena
                con scroll, así ni el resumen queda estirado con aire de sobra ni el registro sobresale. */}
            <div className="grid gap-4 lg:grid-cols-3">
                <div className="flex flex-col gap-4 md:flex-row lg:flex-col">
                    <div className="md:flex-1 lg:flex-none">
                        <SaldoCard saldo={saldo} onRetry={reintentarSaldo} />
                    </div>
                    <div className="md:flex-1">
                        <ResumenBodegaCard productosEnStock={initialCatalogo?.productos.length} pedidos={pedidos} />
                    </div>
                </div>
                <div className="relative min-w-0 lg:col-span-2">
                    <div className="lg:absolute lg:inset-0">
                        <HistorialCard
                            pedidos={pedidos}
                            sincronizadoEn={historial?.sincronizadoEn ?? null}
                            sincronizando={sincronizando}
                            errorSync={errorSync}
                            onSync={() => void sincronizar()}
                        />
                    </div>
                </div>
            </div>

            {/* Tabla genérica (app/ui/table.tsx) en solo lectura, con el encabezado dentro del marco y "Comprar" como acción de la fila. */}
            <Table
                header={["Producto", "Plataforma", "Duración", "Precio"]}
                data={filasVisibles}
                loading={cargando}
                hideCreate
                builtinActions={[]}
                entityName="producto"
                extraActions={(row, layout) => {
                    const Action = layout === "desktop" ? IconAction : MobileAction
                    const enRevision = bloqueado(row.producto)
                    return (
                        <Action
                            icon={ShoppingCart}
                            label={layout === "desktop" ? `Comprar ${row.Producto}` : "Comprar"}
                            title={enRevision ? "Revisa el registro de compras antes de volver a comprar este producto" : `Comprar ${row.Producto}`}
                            tone="accent"
                            disabled={enRevision}
                            onClick={() => abrirCompra(row.producto)}
                        />
                    )
                }}
                filters={(layout) => <FiltrosCatalogo items={items} value={filtro} onChange={setFiltro} mobile={layout === "mobile"} />}
                heading={
                    <SectionHeader
                        icon={Package}
                        title="Catálogo disponible"
                        description={
                            <>
                                {escaneo ? `Stock del escaneo del ${escaneo}` : "Stock del último escaneo al proveedor"}. Al comprar se
                                verifica en vivo — fija el precio de venta en{" "}
                                <Link href={ruta("/administrar/productos")} className="text-accent hover:underline">Productos</Link>.
                            </>
                        }
                    />
                }
            />

            {intencion && (
                <ComprarModal
                    key={intencion.producto.listing_id}
                    producto={intencion.producto}
                    accesoLabel={accesoLabel(intencion.producto)}
                    saldo={saldo ? saldo.saldo : null}
                    escaneo={escaneo}
                    precioEscaneo={intencion.precioEscaneo}
                    vivo={intencion.vivo}
                    onReverificar={() => verificarEnVivo(intencion.producto.listing_id)}
                    pending={isPending}
                    error={modalError}
                    onConfirm={confirmarCompra}
                    onClose={cerrarCompra}
                />
            )}
        </div>
    )
}
