import ComprasClient from "@/app/administrar/compras/compras-client"
import { getMisPedidosAction } from "@action/tienda/get-mis-pedidos-action"
import { getNoLeidosAction } from "@action/tienda/chat-asesor-action"

export default async function PageAdministrarCompras() {
    const [pedidos, noLeidos] = await Promise.all([getMisPedidosAction(), getNoLeidosAction()])
    return <ComprasClient pedidos={pedidos} noLeidos={noLeidos} />
}
