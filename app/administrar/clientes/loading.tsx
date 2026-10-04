// Mientras carga: la misma tabla, en su estado de carga (mismo marco, barra y filas).
import TableClient from "@/app/administrar/clientes/table-client"

export default function Loading() {
    return <TableClient esAdmin={false} esqueleto />
}
