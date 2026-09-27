import { redirect } from "next/navigation"
import { getRoleUser } from "@action/get-role-action"
import PerfilesClient from "@/app/administrar/perfiles/perfiles-client"
import { getAllPerfilesAction } from "@action/manager-and-admin/perfiles/get-all-perfiles-action"

export default async function PageAdministrarPerfiles({ searchParams }: Readonly<{ searchParams: Promise<{ cuenta?: string }> }>) {
    const role = await getRoleUser()
    if (role !== "admin" && role !== "manager") redirect("/administrar")

    const perfiles = await getAllPerfilesAction()
    // ?cuenta=ID llega desde Cuentas ("Ver perfiles"): la tabla abre filtrada por esa cuenta.
    const cuenta = Number((await searchParams).cuenta)

    return <PerfilesClient initialPerfiles={perfiles} initialCuentaId={Number.isInteger(cuenta) && cuenta > 0 ? cuenta : null} />
}
