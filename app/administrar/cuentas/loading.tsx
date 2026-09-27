// Mientras carga: la misma tabla, en su estado de carga (mismo marco, barra y filas).
import CuentasClient from "@/app/administrar/cuentas/cuentas-client"

export default function Loading() {
    return <CuentasClient initialCuentas={undefined} />
}
