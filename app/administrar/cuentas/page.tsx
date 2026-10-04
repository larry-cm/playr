import { redirect } from "next/navigation"
import { rutaServidor } from "@lib/supabase/server"
import { getRoleUser } from "@action/get-role-action"
import CuentasClient from "@/app/administrar/cuentas/cuentas-client"
import { getAllCuentasAction } from "@action/manager-and-admin/cuentas/get-all-cuentas-action"

export default async function PageAdministrarCuentas() {
    const role = await getRoleUser()
    if (role !== "admin" && role !== "manager") redirect(await rutaServidor("/administrar"))

    const cuentas = await getAllCuentasAction()

    return <CuentasClient initialCuentas={cuentas} />
}
