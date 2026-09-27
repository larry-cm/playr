import { redirect } from "next/navigation"
import { getRoleUser } from "@action/get-role-action"
import { getBodegaCatalogoAction } from "@action/manager-and-admin/bodega/get-bodega-action"
import BodegaClient from "@/app/administrar/bodega/bodega-client"
import PageHeader from "@ui/page-header"

// Una compra abre sesión, verifica y paga en el proveedor (varias peticiones HTTP encadenadas): puede pasar del límite por
// defecto de algunos hosts serverless. También cubre las server actions que se invocan desde esta página.
export const maxDuration = 60

export default async function PageAdministrarBodega() {
    const role = await getRoleUser()
    if (role !== "admin" && role !== "manager") redirect("/administrar")

    // El catálogo sale de la base (rápido) y llega resuelto en el primer render; el saldo y el registro de pedidos se leen del
    // sitio del proveedor (más lento) y los pide el cliente, así la página no espera por ellos.
    const catalogo = await getBodegaCatalogoAction()

    return (
        <section className="flex flex-col gap-4">
            <PageHeader title="Bodega" description="Compra stock al proveedor con el saldo de su monedero; lo que llega se registra solo en el inventario." />
            <BodegaClient initialCatalogo={catalogo} simulacion={process.env.BODEGA_SIMULAR === "1"} />
        </section>
    )
}
