import { redirect } from "next/navigation"
import { getRoleUser } from "@action/get-role-action"
import ProductosClient from "@/app/administrar/productos/productos-client"
import { getAllProductosAction } from "@action/manager-and-admin/productos/get-all-productos-action"
import { getLicenciasDisponiblesAction } from "@action/manager-and-admin/productos/get-licencias-disponibles-action"

export default async function PageAdministrarProductos() {
    const role = await getRoleUser()
    if (role !== "admin" && role !== "manager") redirect("/administrar")

    // productos = query normal a la DB (rápida): se espera acá para que la tabla llegue ya renderizada.
    // oferta = escaneo en vivo al proveedor (lento, segundos): se dispara ahora mismo pero SIN esperar,
    // así arranca en paralelo con la carga de la página en vez de esperar a que el admin abra el modal
    // de "Agregar producto". El componente cliente la consume con `use()` recién cuando el modal se abre.
    const productos = await getAllProductosAction()
    const ofertaPromise = getLicenciasDisponiblesAction()

    return (
        <section className="flex flex-col gap-4">
            <header>
                <h1 className="text-2xl font-bold tracking-tight">Productos</h1>
                <p className="text-sm text-secondary mt-1">
                    Configura el costo y el precio de venta de cada producto. Sin precio de venta, no aparece en la Tienda.
                </p>
            </header>
            <ProductosClient initialProductos={productos} ofertaPromise={ofertaPromise} />
        </section>
    )
}
