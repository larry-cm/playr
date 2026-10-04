import { Suspense } from "react"
import { getRoleUser } from "@action/get-role-action"
import { resumeServicesAction } from "@action/manager-and-admin/resume-service-action"
import { getHistorialAction } from "@action/manager-and-admin/bodega/historial-action"
import ViewManagerAndAdmin from "@/app/administrar/view-manager-and-admin"
import Inicio from "@/app/administrar/(inicio)/inicio"
import ComprasCard from "@/app/administrar/(inicio)/compras-card"
import MargenCard from "@/app/administrar/(inicio)/margen-card"
import { evolucionGanancia, type ProductoCatalogo } from "@lib/bodega/margen"
import { getWhatsappAsesor } from "@lib/ajustes"

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

/**
 * Solo admin/manager (RLS de business.producto + getHistorialAction): productos del catálogo con precio de venta y cómo crece la
 * ganancia con cada compra al proveedor. Combos y productos sin precio de venta quedan fuera.
 */
async function Margenes() {
    const { createSupabase } = await import("@lib/supabase/server")
    const [historial, productos] = await Promise.all([
        getHistorialAction(),
        createSupabase().then((s) => s.schema("business").from("producto")
            .select("id,access_type,costo,precio_venta,platform:platform_id(nombre)")
            .eq("exist", true)
            .not("precio_venta", "is", null)
            .not("platform_id", "is", null)),
    ])
    if (productos.error) return <MargenCard evolucion={null} />
    type Fila = { id: number; access_type: ProductoCatalogo["access_type"]; costo: string | null; precio_venta: string; platform: { nombre: string } | null }
    const catalogo: ProductoCatalogo[] = (productos.data as unknown as Fila[]).map((p) => ({
        id: p.id,
        nombre: p.platform?.nombre ?? "",
        access_type: p.access_type,
        costo: p.costo === null ? null : Number(p.costo),
        precio_venta: Number(p.precio_venta),
    }))
    return <MargenCard evolucion={evolucionGanancia(catalogo, historial?.pedidos ?? [])} />
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
            compras={
                <Suspense fallback={<ComprasCard />}>
                    <Compras />
                </Suspense>
            }
            margen={
                <Suspense fallback={<MargenCard />}>
                    <Margenes />
                </Suspense>
            }
        />
    )
}
