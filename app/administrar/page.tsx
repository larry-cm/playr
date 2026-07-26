import ViewClientPage from "@/app/administrar/view-client";
import { getRoleUser } from "@action/get-role-action";
import ViewServer from "@/app/administrar/view-server";

export default async function AdministrarPage() {
    const role = await getRoleUser();

    return (
        <article className="space-y-8">
            <header>
                <h1 className="text-2xl font-bold tracking-tight">Administrar</h1>
            </header>
            {role === "user" && <ViewClientPage />}
            {(role === "admin" || role === "manager") && <ViewServer />}
            {role === "error" && <p className="text-red-400">Error al verificar tu sesión.</p>}
        </article>
    );
}
