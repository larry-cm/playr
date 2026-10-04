// Ganancia por compras para el Dashboard: con cada compra al proveedor de un producto que tiene precio de venta en el catálogo
// (business.producto, misma plataforma + forma), lo pagado contra ese precio de venta, acumulado en el tiempo. Puro (sin React ni
// Supabase). Lo pagado sale del registro de compras (business.historial_proveedor) con preciosDe de consumo.ts: cada producto con
// su precio completo y, en pedidos con varios, por precios de referencia.
import { anulado, ejeDeTiempo, preciosDe, referencias, type Rango } from "@lib/bodega/consumo"
import type { PedidoProveedor } from "@lib/bodega/tipos"

export interface ProductoCatalogo {
    id: number
    /** Nombre de la plataforma (business.platform) o, en un combo, el nombre propio del producto. */
    nombre: string
    access_type: "pantalla" | "completa" | "otro" | "combo"
    costo: number | null
    precio_venta: number
}

/** Forma del producto del proveedor según su nombre: COMPLETA / PANTALLA o PERFIL; COMBO no se cruza con productos simples. */
function formaDe(nombre: string): ProductoCatalogo["access_type"] {
    const n = ` ${nombre.toUpperCase()} `
    if (/ COMBO /.test(n)) return "combo"
    if (/ COMPLETA /.test(n)) return "completa"
    if (/ (PANTALLA|PERFIL) /.test(n)) return "pantalla"
    return "otro"
}

/** ¿El producto del proveedor es de esa plataforma? Misma regla que plataformaDe: la plataforma como palabra en el nombre. */
const esDe = (nombreProducto: string, plataforma: string) =>
    ` ${nombreProducto.toUpperCase().replace(/[()[\],.:;]/g, " ").replace(/\s+/g, " ")} `.includes(` ${plataforma.toUpperCase()} `)

export interface PuntoGanancia {
    /** Día de la compra (YYYY-MM-DD, hora de Colombia). */
    dia: string
    /** Acumulado hasta ese día: lo que pagamos al proveedor, lo que valen al precio de venta y la diferencia. */
    invertido: number
    venta: number
    ganancia: number
    /** Compras de ese día que cuentan (producto del proveedor, producto del catálogo, lo pagado y su precio de venta). */
    compras: { producto: string; catalogo: string; pagado: number; venta: number }[]
}

/**
 * Cómo crece la ganancia con cada compra: por cada producto comprado al proveedor que corresponde a un producto del catálogo
 * con precio de venta (misma plataforma + forma), suma lo pagado y su precio de venta. Las compras que no tienen producto en el
 * catálogo (combos, plataformas sin precio) no cuentan. Es la ganancia si cada compra se vende al precio de hoy: no hay registro
 * de ventas a clientes.
 */
export function evolucionGanancia(productos: ProductoCatalogo[], pedidos: PedidoProveedor[]): PuntoGanancia[] {
    const validos = pedidos.filter((p) => !anulado(p.estado)).sort((a, b) => Date.parse(a.fecha) - Date.parse(b.fecha))
    const refs = referencias(validos)
    const simples = productos.filter((pr) => pr.access_type !== "combo")
    const dias = new Map<string, PuntoGanancia["compras"]>()
    for (const p of validos) {
        const dia = new Date(Date.parse(p.fecha) - 5 * 3_600_000).toISOString().slice(0, 10)
        for (const l of preciosDe(p, refs)) {
            const pr = simples.find((x) => esDe(l.nombre, x.nombre) && formaDe(l.nombre) === x.access_type)
            if (!pr) continue
            const lista = dias.get(dia) ?? []
            lista.push({ producto: l.nombre, catalogo: pr.nombre, pagado: l.precio, venta: pr.precio_venta })
            dias.set(dia, lista)
        }
    }
    let invertido = 0
    let venta = 0
    return [...dias].map(([dia, compras]) => {
        for (const c of compras) { invertido += c.pagado; venta += c.venta }
        return { dia, invertido, venta, ganancia: venta - invertido, compras }
    })
}

export interface PeriodoGanancia {
    key: string
    corta: string
    larga: string
    /** Lo de ese período (no acumulado): lo pagado, lo que vale al precio de venta y la diferencia. */
    invertido: number
    venta: number
    ganancia: number
    compras: PuntoGanancia["compras"]
}

/**
 * Ganancia por período del rango (día en 30 días, semana en 90, mes en 12 meses y Todo; mismos cortes que Compras a
 * proveedores, hora de Colombia). Cada período suma sus compras: invertido + ganancia = venta.
 */
export function gananciaPorPeriodo(puntos: PuntoGanancia[], rango: Rango, ahora = new Date()): PeriodoGanancia[] {
    const ms = (dia: string) => Date.parse(`${dia}T12:00:00-05:00`)
    const eje = ejeDeTiempo(rango, puntos.length ? ms(puntos[0].dia) : null, ahora)
    const out = new Map(eje.periodos.map((p) => [p.key, { ...p, invertido: 0, venta: 0, ganancia: 0, compras: [] as PuntoGanancia["compras"] }]))
    for (const p of puntos) {
        const per = out.get(eje.claveDe(ms(p.dia)))
        if (!per) continue // antes del rango
        for (const c of p.compras) {
            per.invertido += c.pagado
            per.venta += c.venta
            per.ganancia += c.venta - c.pagado
            per.compras.push(c)
        }
    }
    return [...out.values()]
}
