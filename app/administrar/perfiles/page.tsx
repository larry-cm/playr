import { redirect } from "next/navigation"
import { getRoleUser } from "@action/get-role-action"
import PerfilesClient from "@/app/administrar/perfiles/perfiles-client"
import { getAllPerfilesAction } from "@action/manager-and-admin/perfiles/get-all-perfiles-action"
import PageHeader from "@ui/page-header"

export default async function PageAdministrarPerfiles({ searchParams }: Readonly<{ searchParams: Promise<{ cuenta?: string }> }>) {
    const role = await getRoleUser()
    if (role !== "admin" && role !== "manager") redirect("/administrar")

    const perfiles = await getAllPerfilesAction()
    // ?cuenta=ID llega desde Cuentas ("Ver perfiles"): la tabla abre filtrada por esa cuenta.
    const cuenta = Number((await searchParams).cuenta)

    return (
        <section className="flex flex-col gap-4">
            <PageHeader title="Perfiles" description="Las pantallas que se venden, una por fila. Cambia su estado para sacarlas o devolverlas a la Tienda." />
            <PerfilesClient initialPerfiles={perfiles} initialCuentaId={Number.isInteger(cuenta) && cuenta > 0 ? cuenta : null} />
        </section>
    )
}
