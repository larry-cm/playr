import { getRoleUser } from "@action/get-role-action";
import { resumeServicesAction } from "@action/admin/resume-service-action";
import ViewUser from "@/app/administrar/view-user";
import ViewManagerAndAdmin from "@/app/administrar/view-manager-and-admin";

export default async function AdministrarPage() {
    const role = await getRoleUser();
    const { clients: clientes, accounts: cuentas, profiles: perfiles } = await resumeServicesAction();
    return (
        <article className="space-y-8">
            <header>
                <h1 className="text-2xl font-bold tracking-tight">Administrar</h1>
            </header>
            {role === "user" && <ViewUser />}
            {(role === "admin" || role === "manager") && <ViewManagerAndAdmin clientes={clientes} cuentas={cuentas} perfiles={perfiles} />}
            {role === "error" && <p className="text-red-400">Error al verificar tu sesión.</p>}
        </article>
    );
}
