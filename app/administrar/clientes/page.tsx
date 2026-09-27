import { redirect } from "next/navigation"
import { getRoleUser } from "@action/get-role-action"
import TableClient from "@/app/administrar/clientes/table-client"
import PageHeader from "@ui/page-header"

export default async function PageAdministrarClientes() {
    const role = await getRoleUser()
    if (role !== "admin" && role !== "manager") redirect("/administrar")

    return (
        <section className="flex flex-col gap-4">
            <PageHeader title="Clientes" description="Usuarios registrados en la plataforma." />
            <TableClient esAdmin={role === "admin"} />
        </section>
    )
}
