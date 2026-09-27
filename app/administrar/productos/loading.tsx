// Mientras carga: la misma tabla, en su estado de carga (mismo marco, barra y filas).
import ProductosClient from "@/app/administrar/productos/productos-client"

export default function Loading() {
    return <ProductosClient initialProductos={undefined} />
}
