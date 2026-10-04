"use client"

// Esqueleto del inicio: la misma vista que la página según el rol (ya resuelto por el layout). El resumen de servicios
// sale con sus contadores en 0 y las compras y márgenes en esqueleto, igual que el fallback del Suspense de la página, así nada se mueve al llegar los datos.
import { useRol } from "@/app/administrar/dashboard-client"
import Inicio from "@/app/administrar/(inicio)/inicio"
import ViewManagerAndAdmin from "@/app/administrar/view-manager-and-admin"
import ComprasCard from "@/app/administrar/(inicio)/compras-card"
import MargenCard from "@/app/administrar/(inicio)/margen-card"

export default function AdministrarLoading() {
    const role = useRol()
    // El cliente no tiene Dashboard: la página lo redirige a la Tienda, así que no se pinta nada.
    if (role === "user") return null
    return <Inicio role={role} resumen={<ViewManagerAndAdmin />} compras={<ComprasCard />} margen={<MargenCard />} />
}
