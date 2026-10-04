import ComprasClient from "@/app/administrar/compras/compras-client"
import { getMisPedidosAction } from "@action/tienda/get-mis-pedidos-action"
import { getNoLeidosAction } from "@action/tienda/chat-asesor-action"

export default async function PageAdministrarCompras({ searchParams }: Readonly<{ searchParams: Promise<{ chat?: string; compartido?: string }> }>) {
    const [pedidos, noLeidos, { chat, compartido }] = await Promise.all([getMisPedidosAction(), getNoLeidosAction(), searchParams])
    // ?chat=<id>: llega desde "Pagar por QR" y abre el chat sobre ese pedido.
    const chatInicial = Number(chat)
    // ?compartido=1: llega del "Compartir" de otra app (public/sw.js), con el archivo en IndexedDB.
    return (
        <ComprasClient
            pedidos={pedidos}
            noLeidos={noLeidos}
            chatInicial={Number.isInteger(chatInicial) && chatInicial > 0 ? chatInicial : null}
            compartido={compartido === "1"}
        />
    )
}
