// Mientras carga: la misma lista en su estado de carga.
import ComprasClient from "@/app/administrar/compras/compras-client"

export default function Loading() {
    return <ComprasClient pedidos={undefined} />
}
