import TableClient from "@/app/administrar/clientes/table-client"

export default function PageAdministrarClientes() {
    return (
        <section className="flex flex-col gap-4">
            <header>
                <h1 className="text-2xl font-bold tracking-tight">Administrar Clientes</h1>
            </header>
            <TableClient />
        </section>
    )
}
