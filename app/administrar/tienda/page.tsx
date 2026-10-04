import { redirect } from "next/navigation"
import { rutaServidor } from "@lib/supabase/server"
import { getRoleUser } from "@action/get-role-action"
import TiendaClient from "@/app/administrar/tienda/tienda-client"
import { getCatalogoDisponibleAction } from "@action/tienda/get-catalogo-disponible-action"
import { getWhatsappAsesor } from "@lib/ajustes"

export default async function PageAdministrarTienda() {
    const role = await getRoleUser()
    if (role !== "user") redirect(await rutaServidor("/administrar"))

    // Se resuelve en el servidor antes de renderizar: el cliente ya recibe el catálogo listo en el
    // primer render, sin el spinner de un fetch posterior al montar. create/edit/delete de productos
    // llaman revalidatePath("/administrar/tienda"), así que la próxima carga de esta página ya sale fresca.
    // El número del asesor lo configura el admin en Ajustes (sin redesplegar); se lee en paralelo con el catálogo.
    const [catalogo, telefonoAsesor] = await Promise.all([getCatalogoDisponibleAction(), getWhatsappAsesor()])

    return <TiendaClient initialCatalogo={catalogo} telefonoAsesor={telefonoAsesor} />
}
