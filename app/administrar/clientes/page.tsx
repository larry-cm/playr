import TableClient from "@/app/administrar/clientes/table-client"
import PageHeader from "@ui/page-header"

export default function PageAdministrarClientes() {
    return (
        <section className="flex flex-col gap-4">
            <PageHeader title="Clientes" description="Usuarios registrados en la plataforma." />
            <TableClient />
        </section>
    )
}
