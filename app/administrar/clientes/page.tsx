import Table from "@ui/table";
import { getCustomersAction } from "@action/admin/get-customers-action";

export default async function PageAdministrarClientes() {
    const header = ["Nombre", "Correo", "Teléfono", "Fecha de Creación"];
    const customers = await getCustomersAction();

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Administrar Clientes</h1>
                <p className="text-sm text-muted-foreground">Crea, edita y elimina clientes de tu aplicación.</p>
            </div>

            <div>
                <h2 className="text-lg font-medium mb-2">Tabla de prueba</h2>
                <Table header={header} data={customers} />
            </div>
        </div>
    );
}