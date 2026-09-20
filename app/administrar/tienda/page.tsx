import { redirect } from "next/navigation"
import { getRoleUser } from "@action/get-role-action"
import TiendaClient from "@/app/administrar/tienda/tienda-client"

export default async function PageAdministrarTienda() {
    const role = await getRoleUser()
    if (role !== "user") redirect("/administrar")

    return (
        <section className="flex flex-col gap-4">
            <header>
                <h1 className="text-2xl font-bold tracking-tight">Tienda</h1>
            </header>
            <TiendaClient />
        </section>
    )
}
