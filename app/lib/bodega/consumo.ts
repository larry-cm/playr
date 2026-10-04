// Consumo de Bodega para el Dashboard: agrega el registro de compras (PedidoProveedor[], business.historial_proveedor) por
// período, con indicadores y precio por producto. Puro (sin React ni Supabase). Fechas en hora de Colombia (UTC-5, sin
// horario de verano), igual que el Resumen de Bodega; los pedidos anulados no cuentan porque no gastaron saldo.
import type { PedidoProveedor } from "@lib/bodega/tipos"
import { capitalizar } from "@lib/text"

export type Rango = "30d" | "90d" | "12m" | "todo"
export type Granularidad = "dia" | "semana" | "mes"

export const RANGOS: { value: Rango; label: string }[] = [
    { value: "30d", label: "30 días" },
    { value: "90d", label: "90 días" },
    { value: "12m", label: "12 meses" },
    { value: "todo", label: "Todo" },
]

const GRANULARIDAD: Record<Rango, Granularidad> = { "30d": "dia", "90d": "semana", "12m": "mes", todo: "mes" }
const DIA = 86_400_000
const BOGOTA = -5 * 3_600_000

export const anulado = (estado: string) => /fall|cancel|reembols/i.test(estado)

/** Fecha "de pared" en Colombia como Date UTC (leer siempre con getUTC*). */
const local = (ms: number) => new Date(ms + BOGOTA)
const iso = (d: Date) => d.toISOString().slice(0, 10)

/** Inicio del período (día, lunes de la semana o día 1 del mes) en hora de Colombia, como Date UTC "de pared". */
function inicioPeriodo(d: Date, g: Granularidad): Date {
    const r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), g === "mes" ? 1 : d.getUTCDate()))
    if (g === "semana") r.setUTCDate(r.getUTCDate() - ((r.getUTCDay() + 6) % 7))
    return r
}

function siguiente(d: Date, g: Granularidad): Date {
    const r = new Date(d)
    if (g === "mes") r.setUTCMonth(r.getUTCMonth() + 1)
    else r.setUTCDate(r.getUTCDate() + (g === "semana" ? 7 : 1))
    return r
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-CO", { ...opts, timeZone: "UTC" })
const fDia = fmt({ day: "numeric", month: "short" })
const fMes = fmt({ month: "short", year: "2-digit" })
const fMesLargo = fmt({ month: "long", year: "numeric" })
const fDiaLargo = fmt({ weekday: "short", day: "numeric", month: "long", year: "numeric" })

function etiquetas(d: Date, g: Granularidad): { corta: string; larga: string } {
    if (g === "dia") return { corta: fDia.format(d), larga: fDiaLargo.format(d) }
    if (g === "mes") return { corta: fMes.format(d), larga: fMesLargo.format(d) }
    const fin = new Date(d.getTime() + 6 * DIA)
    return { corta: fDia.format(d), larga: `Semana del ${fDia.format(d)} al ${fDia.format(fin)}` }
}

export interface Periodo {
    key: string
    corta: string
    larga: string
    gasto: number
    /** Productos comprados (una cuenta de varias pantallas o un combo cuenta como UNO). */
    productos: number
    /** Pedidos del período, del más nuevo al más viejo. */
    pedidos: PedidoProveedor[]
    /** Gasto por plataforma en el período (nombre para mostrar de plataformaDe; los combos van juntos en "Combos"). */
    plataformas: Record<string, number>
    /** Cada producto del período con su plataforma: cuántas veces se compró, cuántas pantallas trajo y lo pagado en total. */
    detalle: Record<string, { plataforma: string; compras: number; pantallas: number; gasto: number; estimado: boolean }>
}

export interface Consumo {
    granularidad: Granularidad
    periodos: Periodo[]
    gastado: number
    pedidos: number
    productos: number
    ticketPromedio: number
    mayorCompra: PedidoProveedor | null
    /** Gasto del mismo largo de tiempo justo antes del rango; null en "Todo". */
    gastadoAnterior: number | null
    /** Plataformas con gasto en el rango, de mayor a menor. */
    plataformas: { nombre: string; gasto: number }[]
}

export const COMBOS = "Combos"

/** "APPLE TV" -> "Apple TV", "HBO" -> "HBO", "NETFLIX" -> "Netflix": las siglas cortas quedan en mayúsculas. */
const nombrePlataforma = (p: string) =>
    p.split(" ").map((w) => (w.length <= 3 ? w : w.charAt(0) + w.slice(1).toLocaleLowerCase("es"))).join(" ")

/**
 * Plataforma del producto, con el mismo criterio que el scraper del catálogo (stock-price-watch `clasificar`): la de nombre más
 * largo contenida como palabra en el nombre; COMBO = varias marcas ("Combos"). Sin plataforma reconocida, el producto es su propio grupo (con su nombre): nunca un
 * grupo "Otras" sin identificar.
 */
export function plataformaDe(nombre: string, plataformas: string[]): string {
    const n = ` ${nombre.toUpperCase().replace(/[()[\],.:;]/g, " ").replace(/\s+/g, " ")} `
    if (/ COMBO /.test(n)) return COMBOS
    const hit = plataformas.filter((p) => n.includes(` ${p.toUpperCase()} `)).sort((a, b) => b.length - a.length)[0]
    return hit ? nombrePlataforma(hit.toUpperCase()) : capitalizar(nombre)
}

/**
 * Productos del pedido. `cantidad` de PedidoProveedor cuenta LICENCIAS entregadas ("Mis licencias"): una cuenta de 3 pantallas
 * o un combo llega como varias licencias de un solo producto. Por eso un producto cuenta como uno y su precio es el de la cuenta
 * completa, nunca precio por pantalla.
 */
const productosDe = (p: PedidoProveedor) => p.productos.length || p.articulos

/** Precio de cada producto según los pedidos que lo traen SOLO (ahí el total del pedido es su precio exacto), con su fecha. */
export type Referencias = Map<string, { t: number; precio: number }[]>

export function referencias(pedidos: PedidoProveedor[]): Referencias {
    const refs: Referencias = new Map()
    for (const p of pedidos) {
        if (p.productos.length !== 1) continue
        const lista = refs.get(p.productos[0].nombre) ?? []
        lista.push({ t: Date.parse(p.fecha), precio: p.total })
        refs.set(p.productos[0].nombre, lista)
    }
    return refs
}

/** El precio de referencia más cercano en el tiempo a t (los precios del proveedor cambian). */
function referencia(refs: Referencias, nombre: string, t: number): number | null {
    const lista = refs.get(nombre)
    if (!lista?.length) return null
    return lista.reduce((m, r) => (Math.abs(r.t - t) < Math.abs(m.t - t) ? r : m)).precio
}

/**
 * Precio de cada producto del pedido (el del producto completo: cuenta o combo con todas sus pantallas). El proveedor solo
 * informa el TOTAL del pedido: con un producto ese es su precio. Con varios, cada uno toma su precio de referencia (pedidos
 * donde vino solo) y el resto del total va a los que no la tienen; si todos la tienen, se ajustan en proporción. La suma es
 * siempre el total del pedido.
 */
export function preciosDe(p: PedidoProveedor, refs: Referencias = new Map()): { nombre: string; pantallas: number; precio: number; estimado: boolean }[] {
    if (p.productos.length <= 1) return p.productos.map((x) => ({ nombre: x.nombre, pantallas: x.cantidad, precio: p.total, estimado: false }))
    // precio exacto de cada producto, leído del detalle del pedido al sincronizar
    if (p.productos.every((x) => x.precio !== undefined)) {
        return p.productos.map((x) => ({ nombre: x.nombre, pantallas: x.cantidad, precio: x.precio as number, estimado: false }))
    }
    // pedidos guardados antes de leer el detalle: se estima con precios de referencia (la próxima sincronización los corrige)
    const t = Date.parse(p.fecha)
    const lineas = p.productos.map((x) => ({ ...x, ref: referencia(refs, x.nombre, t) }))
    const conocido = lineas.reduce((s, l) => s + (l.ref ?? 0), 0)
    const sinRef = lineas.filter((l) => l.ref === null).length
    const resto = p.total - conocido

    let precio: (l: (typeof lineas)[number]) => number
    if (sinRef && resto > 0) precio = (l) => l.ref ?? resto / sinRef
    else if (!sinRef && conocido > 0) precio = (l) => (l.ref as number) * (p.total / conocido)
    else precio = () => p.total / lineas.length // sin referencias útiles: reparto parejo
    return lineas.map((l) => ({ nombre: l.nombre, pantallas: l.cantidad, precio: precio(l), estimado: true }))
}

function desdeRango(rango: Rango, ahora: Date): number | null {
    if (rango === "todo") return null
    if (rango === "12m") {
        const d = local(ahora.getTime())
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 11, 1) - BOGOTA
    }
    const dias = rango === "30d" ? 30 : 90
    return inicioPeriodo(local(ahora.getTime() - (dias - 1) * DIA), "dia").getTime() - BOGOTA
}

/**
 * Eje de tiempo de un rango, igual al de calcularConsumo: los períodos continuos (también los vacíos) desde el inicio del rango
 * (o desde `primeroMs` en "Todo") hasta hoy, y la clave del período de una fecha. Lo usa también la tarjeta de ganancia.
 */
export function ejeDeTiempo(rango: Rango, primeroMs: number | null, ahora = new Date()) {
    const g = GRANULARIDAD[rango]
    const desde = desdeRango(rango, ahora)
    const periodos: { key: string; corta: string; larga: string }[] = []
    const fin = inicioPeriodo(local(ahora.getTime()), g)
    for (let d = inicioPeriodo(local(desde ?? primeroMs ?? ahora.getTime()), g); d <= fin; d = siguiente(d, g)) {
        periodos.push({ key: iso(d), ...etiquetas(d, g) })
    }
    return { granularidad: g, desde, periodos, claveDe: (ms: number) => iso(inicioPeriodo(local(ms), g)) }
}

/** `plataformas`: nombres de business.platform, para agrupar cada producto en su plataforma. */
export function calcularConsumo(todos: PedidoProveedor[], rango: Rango, plataformas: string[], ahora = new Date()): Consumo {
    const g = GRANULARIDAD[rango]
    const validos = todos.filter((p) => !anulado(p.estado)).sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha))
    const refs = referencias(validos)
    const desde = desdeRango(rango, ahora)
    const enRango = desde === null ? validos : validos.filter((p) => Date.parse(p.fecha) >= desde)

    // Períodos continuos (también los vacíos: el eje de tiempo no se salta días sin compras).
    const primero = desde ?? (enRango.length ? Date.parse(enRango[enRango.length - 1].fecha) : ahora.getTime())
    const periodos = new Map<string, Periodo>()
    const fin = inicioPeriodo(local(ahora.getTime()), g)
    for (let d = inicioPeriodo(local(primero), g); d <= fin; d = siguiente(d, g)) {
        periodos.set(iso(d), { key: iso(d), ...etiquetas(d, g), gasto: 0, productos: 0, pedidos: [], plataformas: {}, detalle: {} })
    }
    const porPlataforma = new Map<string, number>()
    for (const p of enRango) {
        const per = periodos.get(iso(inicioPeriodo(local(Date.parse(p.fecha)), g)))
        if (!per) continue
        per.gasto += p.total
        per.productos += productosDe(p)
        per.pedidos.push(p)
        // pedido sin productos (sin licencias ni artículos legibles): va con su número para que la barra sume el gasto real
        const lineas = p.productos.length
            ? preciosDe(p, refs)
            : [{ nombre: `Pedido #${p.id}`, pantallas: 0, precio: p.total, estimado: false }]
        for (const l of lineas) {
            // combos (varias plataformas) van a "Combos"; las cuentas de una plataforma suman en esa plataforma
            const plataforma = plataformaDe(l.nombre, plataformas)
            const x = (per.detalle[l.nombre] ??= { plataforma, compras: 0, pantallas: 0, gasto: 0, estimado: false })
            x.compras += 1
            x.pantallas += l.pantallas
            x.gasto += l.precio
            x.estimado ||= l.estimado
            per.plataformas[plataforma] = (per.plataformas[plataforma] ?? 0) + l.precio
            porPlataforma.set(plataforma, (porPlataforma.get(plataforma) ?? 0) + l.precio)
        }
    }

    const gastado = enRango.reduce((s, p) => s + p.total, 0)
    const largo = desde === null ? 0 : ahora.getTime() - desde
    const gastadoAnterior = desde === null
        ? null
        : validos.filter((p) => { const t = Date.parse(p.fecha); return t >= desde - largo && t < desde }).reduce((s, p) => s + p.total, 0)

    return {
        granularidad: g,
        periodos: [...periodos.values()],
        gastado,
        pedidos: enRango.length,
        productos: enRango.reduce((s, p) => s + productosDe(p), 0),
        ticketPromedio: enRango.length ? gastado / enRango.length : 0,
        mayorCompra: enRango.reduce<PedidoProveedor | null>((m, p) => (!m || p.total > m.total ? p : m), null),
        gastadoAnterior,
        plataformas: [...porPlataforma].map(([nombre, gasto]) => ({ nombre, gasto })).sort((a, b) => b.gasto - a.gasto),
    }
}
