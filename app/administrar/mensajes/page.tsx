import MensajesClient from "@/app/administrar/mensajes/mensajes-client"
import { getConversacionesAction } from "@action/manager-and-admin/mensajes/mensajes-action"

export default async function PageAdministrarMensajes({ searchParams }: Readonly<{ searchParams: Promise<{ cliente?: string }> }>) {
    const [bandeja, { cliente }] = await Promise.all([getConversacionesAction(), searchParams])
    return <MensajesClient conversaciones={bandeja?.conversaciones ?? null} clienteInicial={cliente ?? null} />
}
