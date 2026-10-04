import ComprasClient from "@/app/administrar/compras/compras-client"
import { getMisPedidosAction } from "@action/tienda/get-mis-pedidos-action"

export default async function PageAdministrarCompras() {
    const pedidos = await getMisPedidosAction()
    return <ComprasClient pedidos={pedidos} />
}
