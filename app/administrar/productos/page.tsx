import { redirect } from "next/navigation"
import { getRoleUser } from "@action/get-role-action"
import ProductosClient from "@/app/administrar/productos/productos-client"
import { getAllProductosAction } from "@action/manager-and-admin/productos/get-all-productos-action"
import { getLicenciasDisponiblesAction } from "@action/manager-and-admin/productos/get-licencias-disponibles-action"
import { getOfertaProveedorAction } from "@action/manager-and-admin/productos/get-oferta-proveedor-action"

export default async function PageAdministrarProductos() {
    const role = await getRoleUser()
    if (role !== "admin" && role !== "manager") redirect("/administrar")

    // productos y oferta = queries normales a la DB (rápidas): se esperan acá para que la tabla y el
    // armador de combos lleguen ya renderizados.
    // licencias = escaneo en vivo al proveedor (lento, segundos): se dispara ahora mismo pero SIN
    // esperar, así arranca en paralelo con la carga de la página en vez de esperar a que el admin
    // abra el modal de "Agregar producto". El cliente la consume con `use()` al abrir el modal.
    const [productos, oferta] = await Promise.all([getAllProductosAction(), getOfertaProveedorAction()])
    const licenciasPromise = getLicenciasDisponiblesAction()

    return <ProductosClient initialProductos={productos} licenciasPromise={licenciasPromise} oferta={oferta} />
}
