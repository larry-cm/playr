import { redirect } from "next/navigation"
import { getRoleUser } from "@action/get-role-action"
import { getBodegaCatalogoAction } from "@action/manager-and-admin/bodega/get-bodega-action"
import { getComprasBodegaAction } from "@action/manager-and-admin/bodega/compras-action"
import BodegaClient from "@/app/administrar/bodega/bodega-client"

// Una compra abre sesión, verifica y paga en el proveedor (varias peticiones HTTP encadenadas): puede pasar del límite por
// defecto de algunos hosts serverless. También cubre las server actions que se invocan desde esta página.
export const maxDuration = 60

export default async function PageAdministrarBodega() {
    const role = await getRoleUser()
    if (role !== "admin" && role !== "manager") redirect("/administrar")

    // El catálogo y el historial salen de la base (rápido) y llegan resueltos en el primer render; el saldo se lee del sitio del
    // proveedor (más lento) y lo pide el cliente, así la página no espera por él.
    const [catalogo, compras] = await Promise.all([getBodegaCatalogoAction(), getComprasBodegaAction()])

    return (
        <section className="flex flex-col gap-4">
            <header>
                <h1 className="text-2xl font-bold tracking-tight">Bodega</h1>
                <p className="text-sm text-secondary mt-1">
                    Compra stock en el proveedor con el saldo de su monedero. Lo que llega se registra solo en el inventario.
                </p>
            </header>
            <BodegaClient initialCatalogo={catalogo} initialCompras={compras} simulacion={process.env.BODEGA_SIMULAR === "1"} />
        </section>
    )
}
