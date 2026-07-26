import { getRoleUser } from "@action/get-role-action";
import ViewManagerAndAdmin from "@/app/administrar/view-manager-and-admin";
import ViewUser from "@/app/administrar/view-user";

export default async function AdministrarPage() {
    const role = await getRoleUser();

    return (
        <article className="space-y-8">
            <header>
                <h1 className="text-2xl font-bold tracking-tight">Administrar</h1>
            </header>
            {role === "user" && <ViewUser />}
            {(role === "admin" || role === "manager") && <ViewManagerAndAdmin />}
            {role === "error" && <p className="text-red-400">Error al verificar tu sesión.</p>}
        </article>
    );
}
