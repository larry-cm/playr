import { redirect } from "next/navigation"
import { getRoleUser } from "@action/get-role-action"
import PerfilesClient from "@/app/administrar/perfiles/perfiles-client"
import { getAllPerfilesAction } from "@action/manager-and-admin/perfiles/get-all-perfiles-action"

export default async function PageAdministrarPerfiles() {
    const role = await getRoleUser()
    if (role !== "admin" && role !== "manager") redirect("/administrar")

    const perfiles = await getAllPerfilesAction()

    return (
        <section className="flex flex-col gap-4">
            <header>
                <h1 className="text-2xl font-bold tracking-tight">Perfiles</h1>
                <p className="text-sm text-secondary mt-1">
                    Las pantallas individuales que se venden, una por fila. Llegan con cada compra al proveedor; acá se
                    marca su estado para sacarlas o devolverlas a la Tienda.
                </p>
            </header>
            <PerfilesClient initialPerfiles={perfiles} />
        </section>
    )
}
