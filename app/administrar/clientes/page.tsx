import TableClient from "@/app/administrar/clientes/table-client";
import Card from "@ui/card";
import { AlertCircle } from "lucide-react";

export default async function PageAdministrarClientes() {
    const { getAllCustomersAction } = await import("@action/admin/cusomers/get-all-customers-action");
    const customers = await getAllCustomersAction();
    const hasError = customers === null;
    return (
        <section className="flex flex-col gap-6">
            <header>
                <h1 className="text-2xl font-bold tracking-tight mb-2">Administrar Clientes</h1>
                <p className="text-sm text-muted-foreground">Crea, edita y elimina clientes de tu aplicación.</p>
            </header>

            {
                hasError ? (
                    <Card className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400 mb-4 shadow-lg shadow-red-500/5">
                            <AlertCircle className="h-7 w-7" />
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-1">
                            Error al cargar los clientes
                        </h3>
                        <p className="text-sm text-white/60 max-w-md">
                            Tuvimos un problema al obtener la información. Por favor intenta de nuevo más tarde o verifica la conexión.
                        </p>
                    </Card>
                ) : (
                    <TableClient customers={customers} />
                )
            }
        </section>
    );
}