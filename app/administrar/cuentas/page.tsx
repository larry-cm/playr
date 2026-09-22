import { redirect } from "next/navigation"
import { getRoleUser } from "@action/get-role-action"
import CuentasClient from "@/app/administrar/cuentas/cuentas-client"
import { getAllCuentasAction } from "@action/manager-and-admin/cuentas/get-all-cuentas-action"

export default async function PageAdministrarCuentas() {
    const role = await getRoleUser()
    if (role !== "admin" && role !== "manager") redirect("/administrar")

    const cuentas = await getAllCuentasAction()

    return (
        <section className="flex flex-col gap-4">
            <header>
                <h1 className="text-2xl font-bold tracking-tight">Cuentas</h1>
                <p className="text-sm text-secondary mt-1">
                    Los logins que le compraste al proveedor. Cada cuenta agrupa los perfiles de una plataforma; aparecen
                    solas al registrar una compra, acá se ajusta su vencimiento, su costo y su capacidad.
                </p>
            </header>
            <CuentasClient initialCuentas={cuentas} />
        </section>
    )
}
