import ViewClientPage from "@/app/administrar/view-client";
import { getRoleUser } from "@action/get-role-action";

export default async function AdministrarPage() {
    const role = await getRoleUser();

    return (
        <article className="space-y-8">
            <header>
                <h1 className="text-2xl font-bold tracking-tight">Administrar</h1>
                <p className="text-secondary text-sm mt-1.5">
                    Gestiona tus cuentas y perfiles de manera sencilla.
                </p>
            </header>
            {role}
            {/* <ViewClientPage /> */}
        </article>
    );
}
