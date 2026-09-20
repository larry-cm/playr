import { redirect } from "next/navigation"
import { getRoleUser } from "@action/get-role-action"
import ProductosClient from "@/app/administrar/productos/productos-client"

export default async function PageAdministrarProductos() {
    const role = await getRoleUser()
    if (role !== "admin" && role !== "manager") redirect("/administrar")

    return (
        <section className="flex flex-col gap-4">
            <header>
                <h1 className="text-2xl font-bold tracking-tight">Productos</h1>
                <p className="text-sm text-secondary mt-1">
                    Configura el costo y el precio de venta de cada producto. Sin precio de venta, no aparece en la Tienda.
                </p>
            </header>
            <ProductosClient />
        </section>
    )
}
