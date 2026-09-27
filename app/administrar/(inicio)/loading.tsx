"use client"

// Esqueleto del inicio: la misma vista que la página según el rol (ya resuelto por el layout). El resumen de servicios
// sale con sus contadores en 0, igual que el fallback del Suspense de la página, así nada se mueve al llegar los datos.
import { useRol } from "@/app/administrar/dashboard-client"
import Inicio from "@/app/administrar/(inicio)/inicio"
import ViewManagerAndAdmin from "@/app/administrar/view-manager-and-admin"

export default function AdministrarLoading() {
    return <Inicio role={useRol()} resumen={<ViewManagerAndAdmin />} />
}
