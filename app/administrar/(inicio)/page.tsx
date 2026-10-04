import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getRoleUser } from "@action/get-role-action"
import { resumeServicesAction } from "@action/manager-and-admin/resume-service-action"
import { getHistorialAction } from "@action/manager-and-admin/bodega/historial-action"
import ViewManagerAndAdmin from "@/app/administrar/view-manager-and-admin"
import Inicio from "@/app/administrar/(inicio)/inicio"
import ComprasCard from "@/app/administrar/(inicio)/compras-card"

/** Solo admin/manager: el resumen de servicios (conteos) es lo lento, por eso va en su propio Suspense. */
async function ResumenServicios() {
    const services = await resumeServicesAction()
    return <ViewManagerAndAdmin services={services} />
}

/**
 * Solo admin/manager: registro de compras guardado de Bodega (lee la base, no el sitio del proveedor) y las plataformas
 * (business.platform) para agrupar cada producto comprado en la suya.
 */
async function Compras() {
    const { createSupabase } = await import("@lib/supabase/server")
    const [historial, plataformas] = await Promise.all([
        getHistorialAction(),
        createSupabase().then((s) => s.schema("business").from("platform").select("nombre").eq("exist", true)),
    ])
    return <ComprasCard historial={historial} plataformas={plataformas.data?.map((p) => p.nombre as string) ?? []} />
}

export default async function AdministrarPage() {
    // El rol se decide antes del Suspense: así un cliente nunca ve el esqueleto del panel de administración
    // y el resumen de servicios no se consulta para él.
    const role = await getRoleUser()
    // El cliente no tiene Dashboard: su único acceso es la Tienda.
    if (role === "user") redirect("/administrar/tienda")

    return (
        <Inicio
            role={role}
            resumen={
                <Suspense fallback={<ViewManagerAndAdmin />}>
                    <ResumenServicios />
                </Suspense>
            }
            compras={
                <Suspense fallback={<ComprasCard />}>
                    <Compras />
                </Suspense>
            }
        />
    )
}
