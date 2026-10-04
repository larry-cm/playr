import { redirect } from "next/navigation"
import { rutaServidor } from "@lib/supabase/server"
import { getRoleUser } from "@action/get-role-action"
import TiendaClient from "@/app/administrar/tienda/tienda-client"
import { getCatalogoDisponibleAction } from "@action/tienda/get-catalogo-disponible-action"
import { getLlavesBreb } from "@lib/ajustes"

export default async function PageAdministrarTienda() {
    const role = await getRoleUser()
    if (role !== "user") redirect(await rutaServidor("/administrar"))

    // Se resuelve en el servidor antes de renderizar: el cliente ya recibe el catálogo listo en el
    // primer render, sin el spinner de un fetch posterior al montar. create/edit/delete de productos
    // llaman revalidatePath("/administrar/tienda"), así que la próxima carga de esta página ya sale fresca.
    // Las llaves Bre-B las configura el admin en Ajustes (sin redesplegar); se leen en paralelo con el catálogo. La RLS
    // solo le entrega al cliente las visibles.
    const [catalogo, llaves] = await Promise.all([getCatalogoDisponibleAction(), getLlavesBreb()])

    return <TiendaClient initialCatalogo={catalogo} llaves={llaves.map(({ id, nombre, llave, predeterminada, qr_url }) => ({ id, nombre, llave, predeterminada, qr_url }))} />
}
