// Mientras carga: la misma tienda, con tarjetas de carga de la misma forma que las reales.
import TiendaClient from "@/app/administrar/tienda/tienda-client"

export default function Loading() {
    return <TiendaClient initialCatalogo={undefined} telefonoAsesor={undefined} />
}
