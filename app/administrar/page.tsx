import { Suspense } from "react"
import { getRoleUser } from "@action/get-role-action"
import { resumeServicesAction } from "@action/manager-and-admin/resume-service-action"
import ViewUser from "@/app/administrar/view-user"
import ViewManagerAndAdmin from "@/app/administrar/view-manager-and-admin"
import PageHeader from "@ui/page-header"

/** Solo admin/manager: el resumen de servicios (conteos) es lo lento, por eso va en su propio Suspense. */
async function ResumenServicios() {
    const services = await resumeServicesAction()
    return <ViewManagerAndAdmin services={services} />
}

export default async function AdministrarPage() {
    // El rol se decide antes del Suspense: así un cliente nunca ve el esqueleto del panel de administración
    // y el resumen de servicios no se consulta para él.
    const role = await getRoleUser()

    if (role === "user") {
        return (
            <article className="flex flex-col gap-4">
                <PageHeader title="Administrar" description="Compra perfiles en la Tienda y contacta a soporte si algo falla." />
                <ViewUser />
            </article>
        )
    }

    return (
        <article className="flex flex-col gap-4">
            <PageHeader title="Administrar" description="Resumen general y accesos rápidos." />
            {role === "error" ? (
                <p className="text-red-400" role="alert">Error al verificar tu sesión. Recarga la página o vuelve a iniciar sesión.</p>
            ) : (
                <Suspense fallback={<ViewManagerAndAdmin />}>
                    <ResumenServicios />
                </Suspense>
            )}
        </article>
    )
}
