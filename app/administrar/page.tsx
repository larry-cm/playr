import { Suspense } from "react"
import { getRoleUser } from "@action/get-role-action"
import { resumeServicesAction } from "@action/manager-and-admin/resume-service-action"
import ViewUser from "@/app/administrar/view-user"
import ViewManagerAndAdmin from "@/app/administrar/view-manager-and-admin"
import PageHeader from "@ui/page-header"

async function AdministrarContent() {
    const [role, services] = await Promise.all([getRoleUser(), resumeServicesAction()])
    if (role === "user") return <ViewUser />
    if (role === "error") return <p className="text-red-400">Error al verificar tu sesión.</p>
    return <ViewManagerAndAdmin services={services} />
}

export default function AdministrarPage() {
    return (
        <article className="flex flex-col gap-4">
            <PageHeader title="Administrar" description="Resumen general y accesos rápidos." />
            <Suspense fallback={<ViewManagerAndAdmin />}>
                <AdministrarContent />
            </Suspense>
        </article>
    )
}
