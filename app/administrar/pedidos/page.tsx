import PedidosClient from "@/app/administrar/pedidos/pedidos-client"
import { getPedidosAction } from "@action/manager-and-admin/pedidos/get-pedidos-action"

export default async function PageAdministrarPedidos() {
    const pedidos = await getPedidosAction()
    return <PedidosClient pedidos={pedidos} />
}
