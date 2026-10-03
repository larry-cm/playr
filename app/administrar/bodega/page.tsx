import { redirect } from "next/navigation"
import { getRoleUser } from "@action/get-role-action"
import { getBodegaCatalogoAction } from "@action/manager-and-admin/bodega/get-bodega-action"
import { getHistorialAction } from "@action/manager-and-admin/bodega/historial-action"
import BodegaClient from "@/app/administrar/bodega/bodega-client"

// Una compra abre sesión, verifica y paga en el proveedor (varias peticiones HTTP encadenadas): puede pasar del límite por
// defecto de algunos hosts serverless. También cubre las server actions que se invocan desde esta página.
export const maxDuration = 60

export default async function PageAdministrarBodega() {
    const role = await getRoleUser()
    if (role !== "admin" && role !== "manager") redirect("/administrar")

    // Catálogo y registro de compras salen de la base (rápido, en paralelo: aquí son llamadas de servidor, no server actions
    // encoladas) y llegan resueltos en el primer render. El saldo se lee del sitio del proveedor (lento) y lo pide el cliente,
    // que después sincroniza el registro con el sitio solo si tiene más de un día.
    const [catalogo, historial] = await Promise.all([getBodegaCatalogoAction(), getHistorialAction()])

    return <BodegaClient initialCatalogo={catalogo} initialHistorial={historial} simulacion={process.env.BODEGA_SIMULAR === "1"} />
}
