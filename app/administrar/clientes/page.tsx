import { redirect } from "next/navigation"
import { getRoleUser } from "@action/get-role-action"
import TableClient from "@/app/administrar/clientes/table-client"

export default async function PageAdministrarClientes() {
    const role = await getRoleUser()
    if (role !== "admin" && role !== "manager") redirect("/administrar")

    return <TableClient esAdmin={role === "admin"} />
}
