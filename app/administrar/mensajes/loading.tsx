// Mientras carga: la misma bandeja en su estado de carga.
import MensajesClient from "@/app/administrar/mensajes/mensajes-client"

export default function Loading() {
    return <MensajesClient bandeja={undefined} clienteInicial={null} />
}
