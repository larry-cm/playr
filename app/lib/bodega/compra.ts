// Orquestacion de una compra al proveedor con el saldo de su monedero. Sin Next ni supabase-js: todo lo externo entra por
// `deps` (base de datos, credenciales, avisos), asi el flujo completo se prueba contra un proveedor simulado.
//
// Orden y guardas (gasta plata REAL: ante la duda no se paga):
//   1. login en frio, saldo y producto EN VIVO (el precio confirmado por el manager debe seguir siendo el de ahora)
//   2. iniciar_compra: idempotencia por request_id + candado global (el carrito del proveedor es uno solo por cuenta)
//   3. el carrito debe estar VACIO (si hay items ajenos no se toca ni se compra: el checkout los pagaria tambien)
//   4. agregar; el checkout debe mostrar EXACTAMENTE ese item, esa cantidad, ese total, pago con monedero y saldo suficiente
//   5. pagar (solo monedero). Rechazo explicito => 'fallida' (no se cobro). Respuesta dudosa => 'incierta' (NO reintentar)
//   6. la compra queda 'pagada' con su numero de pedido; la entrega se consulta en el registro de compras (pedidos del proveedor)

import {
    agregarAlCarrito, buscarProducto, clave, conectar, leerCheckout, leerSaldo, pagarConMonedero,
    ProveedorError, quitarDelCarrito,
    type CheckoutLeido, type ProveedorCfg, type Sesion,
} from "@lib/bodega/proveedor"
import { MAX_CANTIDAD, type AccessType, type EstadoCompra } from "@lib/bodega/tipos"

export type { EstadoCompra }

/** Si antes de pagar ya pasaron tantos ms (proveedor lento), no se paga: el carrito ajeno/precio podrian haber cambiado. */
const LIMITE_PREVIO_AL_PAGO_MS = 60_000

export interface CompraRow {
    id: number
    request_id: string
    listing_id: number
    cantidad: number
    precio_unitario: number
    total: number
    estado: EstadoCompra
    pedido_proveedor: number | null
    saldo_antes: number | null
    saldo_despues: number | null
    detalle: string | null
    created_at: string
}

export interface ListingRow {
    id: number
    nombre: string
    platformId: number | null
    accessType: AccessType
}

export interface BodegaDb {
    listing(id: number): Promise<ListingRow | null>
    iniciarCompra(a: { requestId: string; listingId: number; cantidad: number; precioUnitario: number; saldo: number }): Promise<
        { nueva: boolean; compra: CompraRow } | { error: "en_curso" | string }
    >
    /** Devuelve un mensaje de error, o null si salio bien. */
    actualizarCompra(id: number, a: { estado: EstadoCompra; pedido?: number | null; saldoDespues?: number | null; detalle?: string }): Promise<string | null>
}

export interface Aviso {
    origen: "scraping" | "plataforma"
    tipo: "error" | "advertencia" | "exito" | "info"
    titulo: string
    mensaje: string
}

export interface CompraDeps {
    db: BodegaDb
    cfg: ProveedorCfg
    /** Deja un aviso en la campana. Nunca debe lanzar. */
    avisar: (a: Aviso) => Promise<void>
    ahora?: () => number
    /**
     * Ensayo: ejecuta TODO igual (login, saldo, producto en vivo, carrito, checkout y sus guardas) y se detiene JUSTO antes de pagar:
     * quita del carrito lo agregado y cierra la compra como 'fallida' ("Simulación"). Garantiza que no se gasta saldo. Solo lo
     * activa el servidor (BODEGA_SIMULAR=1); el cliente no puede pedirlo.
     */
    simular?: boolean
}

const cop = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n)

export interface CompraInput {
    requestId: string
    listingId: number
    cantidad: number
    /** Precio unitario que el manager vio y confirmo: se compara con el precio EN VIVO. */
    precioConfirmado: number
}

export type ResultadoCompra =
    | {
          ok: true
          compra: CompraRow
          saldo: number | null
          mensaje: string
          advertencias: string[]
          /** true = fue un ensayo: no se pago nada. */
          simulado?: boolean
      }
    | { ok: false; error: string; estado?: EstadoCompra; precioActual?: number; saldo?: number | null }

const falla = (error: string, extra: Partial<Extract<ResultadoCompra, { ok: false }>> = {}): ResultadoCompra => ({ ok: false, error, ...extra })

/** Mensaje seguro para mostrar: los ProveedorError ya son nuestros; cualquier otra cosa se registra en el servidor y se oculta. */
function mensajeDe(e: unknown, generico: string): string {
    if (e instanceof ProveedorError) return e.message
    console.error("bodega:", e)
    return generico
}

// ---- compra --------------------------------------------------------------------------------------------------------

export async function comprar(input: CompraInput, deps: CompraDeps): Promise<ResultadoCompra> {
    const { db, cfg, avisar } = deps
    const ahora = deps.ahora ?? Date.now
    const t0 = ahora()

    if (!Number.isInteger(input.cantidad) || input.cantidad < 1 || input.cantidad > MAX_CANTIDAD)
        return falla(`La cantidad debe ser un número entero entre 1 y ${MAX_CANTIDAD}.`)
    if (!Number.isFinite(input.precioConfirmado) || input.precioConfirmado < 0) return falla("Precio inválido.")

    const listing = await db.listing(input.listingId)
    if (!listing) return falla("No encontré ese producto en la bodega.")

    // 1) verificacion EN VIVO (sin tocar nada todavia)
    let s: Sesion
    try {
        s = await conectar(cfg)
    } catch (e) {
        const mensaje = mensajeDe(e, "No pude conectar con el proveedor.")
        await avisar({ origen: "scraping", tipo: "error", titulo: "No se pudo iniciar sesión en el proveedor", mensaje })
        return falla(mensaje)
    }

    let saldo: number
    let vivo: Awaited<ReturnType<typeof buscarProducto>>
    try {
        saldo = await leerSaldo(s)
        vivo = await buscarProducto(s, listing.nombre)
    } catch (e) {
        const mensaje = mensajeDe(e, "No pude verificar el producto en el proveedor.")
        if (e instanceof ProveedorError && (e.codigo === "saldo" || e.codigo === "sitio"))
            await avisar({ origen: "scraping", tipo: "error", titulo: "No se pudo leer el proveedor", mensaje })
        return falla(mensaje)
    }

    if (!vivo.enStock) return falla("El producto está agotado en el proveedor.", { saldo })
    if (!vivo.comprable) return falla("Este producto pide elegir opciones o datos extra en el sitio del proveedor: no se puede comprar desde aquí.", { saldo })
    if (vivo.stockMax !== null && input.cantidad > vivo.stockMax)
        return falla(`Solo ${vivo.stockMax === 1 ? "queda 1 unidad" : `quedan ${vivo.stockMax} unidades`} de este producto en el proveedor.`, { saldo })
    if (vivo.precio !== input.precioConfirmado)
        return falla(`El precio cambió: ahora cuesta ${cop(vivo.precio)} (confirmaste ${cop(input.precioConfirmado)}). Revísalo y vuelve a intentar.`, { precioActual: vivo.precio, saldo })
    const total = vivo.precio * input.cantidad
    if (saldo < total) return falla(`Saldo insuficiente: el pedido cuesta ${cop(total)} y el saldo es ${cop(saldo)}.`, { saldo })

    // 2) idempotencia + candado global
    const inicio = await db.iniciarCompra({ requestId: input.requestId, listingId: listing.id, cantidad: input.cantidad, precioUnitario: vivo.precio, saldo })
    if ("error" in inicio) {
        if (inicio.error === "en_curso") return falla("Hay otra compra en curso. Espera a que termine e inténtalo de nuevo.", { saldo })
        console.error("bodega: iniciar_compra:", inicio.error)
        return falla("No pude registrar la compra. No se pagó nada.", { saldo })
    }
    if (!inicio.nueva)
        return falla(`Esta compra ya fue procesada (estado: ${inicio.compra.estado}). No se compró de nuevo.`, { estado: inicio.compra.estado, saldo })
    const compra = inicio.compra

    const cerrar = async (estado: EstadoCompra, detalle: string, extra: { pedido?: number; saldoDespues?: number | null } = {}) => {
        const err = await db.actualizarCompra(compra.id, { estado, detalle, ...extra })
        if (err) console.error(`bodega: no pude marcar la compra ${compra.id} como ${estado}:`, err)
    }
    /** Falla ANTES de pagar: quita del carrito lo que este flujo agrego (y nada mas), cierra la compra y devuelve el motivo. */
    const abortarSinPagar = async (motivo: string, extra: Partial<Extract<ResultadoCompra, { ok: false }>> = {}) => {
        const limpio = await quitarDelCarrito(s, vivo.id).catch(() => false)
        await cerrar("fallida", motivo + (limpio ? "" : " (revisa que el producto no haya quedado en el carrito del proveedor)"))
        return falla(motivo, { estado: "fallida", saldo, ...extra })
    }

    // 3-4) SOLO lo previo al pago va dentro de este try: si algo falla aqui no se pago nada y se limpia el carrito.
    let co: CheckoutLeido
    try {
        const previo = await leerCheckout(s)
        if (previo.lineas.length > 0 || previo.quitar.length > 0) {
            await cerrar("fallida", "El carrito del proveedor tiene productos ajenos; no se tocó.")
            return falla("El carrito del proveedor ya tiene productos. Vacíalo en el sitio del proveedor y vuelve a intentar (no se compró nada).", { estado: "fallida", saldo })
        }

        await agregarAlCarrito(s, vivo.id, input.cantidad)
        co = await leerCheckout(s)
        const linea = co.lineas[0]
        if (co.lineas.length !== 1 || !linea || clave(linea.nombre) !== clave(listing.nombre) || linea.cantidad !== input.cantidad)
            return await abortarSinPagar("El carrito del proveedor no quedó como se esperaba (producto o cantidad distintos). No se pagó.")
        if (co.total !== total || linea.total !== total)
            return await abortarSinPagar(`El total del checkout (${co.total === null ? "ilegible" : cop(co.total)}) no coincide con el esperado (${cop(total)}). No se pagó.`)
        if (!co.metodos.some((m) => m.id === "wallet")) return await abortarSinPagar("El proveedor no ofrece pagar con monedero en este pedido. No se pagó.")
        if (co.requeridosExtra.length > 0) return await abortarSinPagar("El checkout pide datos adicionales que Playr no maneja. No se pagó.")
        if (!co.campos.some((c) => c.name === "woocommerce-process-checkout-nonce")) return await abortarSinPagar("El checkout del proveedor cambió (falta su código de seguridad). No se pagó.")
        const disponible = co.saldoMostrado ?? saldo
        if (disponible < total) return await abortarSinPagar(`Saldo insuficiente: el pedido cuesta ${cop(total)} y el saldo es ${cop(disponible)}.`, { saldo: disponible })
        if (ahora() - t0 > LIMITE_PREVIO_AL_PAGO_MS) return await abortarSinPagar("El proveedor respondió demasiado lento; por seguridad no se pagó. Inténtalo de nuevo.")
    } catch (e) {
        return await abortarSinPagar(mensajeDe(e, "Error inesperado antes de pagar. No se pagó."))
    }

    // Ensayo: todo lo anterior ya se verifico contra el sitio real; aqui termina, sin pagar.
    if (deps.simular) {
        const limpio = await quitarDelCarrito(s, vivo.id).catch(() => false)
        const detalle = "Simulación: se verificó todo hasta antes de pagar. No se gastó saldo."
        await cerrar("fallida", detalle)
        return {
            ok: true,
            compra: { ...compra, estado: "fallida", detalle },
            saldo,
            mensaje: detalle,
            advertencias: limpio ? [] : ["El producto de la simulación pudo quedar en el carrito del proveedor: revísalo."],
            simulado: true,
        }
    }

    // 5) pagar (solo monedero). Desde aqui NUNCA se dice "no se pagó" salvo rechazo explicito del proveedor.
    let pedidoId: number
    try {
        pedidoId = (await pagarConMonedero(s, co)).pedidoId
    } catch (e) {
        if (e instanceof ProveedorError && e.codigo === "pago") return await abortarSinPagar(`El proveedor rechazó el pedido: ${e.message}`)
        const mensaje = mensajeDe(e, "No pude confirmar el pago con el proveedor.")
        await cerrar("incierta", `${mensaje} Verifica los pedidos y el saldo en el proveedor ANTES de reintentar.`)
        await avisar({
            origen: "plataforma", tipo: "error", titulo: "Compra sin confirmar: verifica el proveedor",
            mensaje: `${listing.nombre} ×${input.cantidad} (${cop(total)}): ${mensaje} Revisa "Tus pedidos" y el saldo en el proveedor antes de reintentar.`,
        })
        return falla(`${mensaje} Verifica los pedidos y el saldo en el proveedor ANTES de reintentar.`, { estado: "incierta" })
    }
    // 6) ya se pago: nada de aqui en adelante puede presentarse como "no se pago"
    const saldoDespues = await leerSaldo(s).catch(() => null)
    const detalle = `Pedido #${pedidoId} pagado.`
    await cerrar("pagada", detalle, { pedido: pedidoId, saldoDespues })

    const advertencias: string[] = []
    if (saldoDespues !== null && Math.abs(saldo - total - saldoDespues) > 0.5)
        advertencias.push(`El saldo esperado era ${cop(saldo - total)} pero el proveedor muestra ${cop(saldoDespues)}. Revisa los movimientos.`)
    return {
        ok: true,
        compra: { ...compra, estado: "pagada", pedido_proveedor: pedidoId, saldo_despues: saldoDespues, detalle },
        saldo: saldoDespues,
        mensaje: detalle,
        advertencias,
    }
}
