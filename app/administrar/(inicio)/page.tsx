import { Suspense } from "react"
import { getRoleUser } from "@action/get-role-action"
import { resumeServicesAction } from "@action/manager-and-admin/resume-service-action"
import ViewManagerAndAdmin from "@/app/administrar/view-manager-and-admin"
import Inicio from "@/app/administrar/(inicio)/inicio"
import { getWhatsappAsesor } from "@lib/ajustes"

/** Solo admin/manager: el resumen de servicios (conteos) es lo lento, por eso va en su propio Suspense. */
async function ResumenServicios() {
    const services = await resumeServicesAction()
    return <ViewManagerAndAdmin services={services} />
}

export default async function AdministrarPage() {
    // El rol se decide antes del Suspense: así un cliente nunca ve el esqueleto del panel de administración
    // y el resumen de servicios no se consulta para él.
    const role = await getRoleUser()
    // Solo el cliente ve Soporte; el número lo configura el admin en Ajustes.
    const telefonoAsesor = role === "user" ? await getWhatsappAsesor() : undefined

    return (
        <Inicio
            role={role}
            telefonoAsesor={telefonoAsesor}
            resumen={
                <Suspense fallback={<ViewManagerAndAdmin />}>
                    <ResumenServicios />
                </Suspense>
            }
        />
    )
}
