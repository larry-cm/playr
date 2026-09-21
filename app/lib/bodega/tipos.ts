// Tipos y constantes compartidos entre el servidor (compra, acciones) y la UI de Bodega. Sin imports: se puede cargar desde un
// componente cliente sin arrastrar codigo de servidor.

export const MAX_CANTIDAD = 10

export type AccessType = "completa" | "pantalla" | "otro"

export type EstadoCompra = "iniciada" | "pagada" | "registrada" | "pendiente_registro" | "fallida" | "incierta"

/** Un producto del proveedor que el ultimo escaneo del cron vio en stock. */
export interface BodegaProducto {
    listing_id: number
    nombre: string
    platform_id: number | null
    platform_nombre: string | null
    access_type: AccessType
    precio: number
    combo: boolean
}

export interface BodegaCatalogo {
    productos: BodegaProducto[]
    /** Fecha (YYYY-MM-DD) del escaneo del que salen los productos. El cron solo guarda la fecha, no la hora. */
    escaneo: string | null
}

export interface CompraHistorial {
    id: number
    producto: string
    cantidad: number
    total: number
    estado: EstadoCompra
    pedido_proveedor: number | null
    detalle: string | null
    created_at: string
}

export interface SaldoProveedor {
    saldo: number
    /** ISO del momento en que se leyo del proveedor. */
    leidoEn: string
}

export interface ResultadoCompraUI {
    ok: boolean
    mensaje: string
    /** Nivel del aviso a mostrar: exito, advertencia (pagado con algo pendiente) o error. */
    nivel: "success" | "warning" | "error" | "info"
    saldo?: number | null
    precioActual?: number
    estado?: EstadoCompra
    simulado?: boolean
}
