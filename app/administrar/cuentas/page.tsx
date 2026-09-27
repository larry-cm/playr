import { redirect } from "next/navigation"
import { getRoleUser } from "@action/get-role-action"
import CuentasClient from "@/app/administrar/cuentas/cuentas-client"
import { getAllCuentasAction } from "@action/manager-and-admin/cuentas/get-all-cuentas-action"
import PageHeader from "@ui/page-header"

export default async function PageAdministrarCuentas() {
    const role = await getRoleUser()
    if (role !== "admin" && role !== "manager") redirect("/administrar")

    const cuentas = await getAllCuentasAction()

    return (
        <section className="flex flex-col gap-4">
            <PageHeader title="Cuentas" description="Los logins comprados al proveedor. Ajusta su vencimiento, su costo y cuántos perfiles admiten." />
            <CuentasClient initialCuentas={cuentas} />
        </section>
    )
}
