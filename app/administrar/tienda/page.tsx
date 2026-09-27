import { redirect } from "next/navigation"
import { getRoleUser } from "@action/get-role-action"
import TiendaClient from "@/app/administrar/tienda/tienda-client"
import { getCatalogoDisponibleAction } from "@action/tienda/get-catalogo-disponible-action"
import PageHeader from "@ui/page-header"

export default async function PageAdministrarTienda() {
    const role = await getRoleUser()
    if (role !== "user") redirect("/administrar")

    // Se resuelve en el servidor antes de renderizar: el cliente ya recibe el catálogo listo en el
    // primer render, sin el spinner de un fetch posterior al montar. create/edit/delete de productos
    // llaman revalidatePath("/administrar/tienda"), así que la próxima carga de esta página ya sale fresca.
    const catalogo = await getCatalogoDisponibleAction()

    return (
        <section className="flex flex-col gap-4">
            <PageHeader title="Tienda" description="Elige los perfiles que quieres y pídelos por WhatsApp." />
            <TiendaClient initialCatalogo={catalogo} />
        </section>
    )
}
