// Mientras carga: la misma pantalla con la barra de filtros y tarjetas de carga.
import PedidosClient from "@/app/administrar/pedidos/pedidos-client"

export default function Loading() {
    return <PedidosClient pedidos={undefined} />
}
