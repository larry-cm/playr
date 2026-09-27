// Mientras carga: la misma Bodega en su estado de carga (sin leer nada del proveedor). El aviso de simulación
// se decide igual que en la página, así no aparece de golpe al llegar los datos.
import BodegaClient from "@/app/administrar/bodega/bodega-client"

export default function Loading() {
    return <BodegaClient initialCatalogo={undefined} simulacion={process.env.BODEGA_SIMULAR === "1"} />
}
