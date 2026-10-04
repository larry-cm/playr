import type { ReactNode } from "react"
import ViewUser from "@/app/administrar/view-user"
import PageHeader from "@ui/page-header"

/** Inicio del panel según el rol. Lo comparten la página y su esqueleto (loading.tsx), así ambos miden lo mismo. */
export default function Inicio({ role, resumen, compras, margen, telefonoAsesor }: Readonly<{
    role: string
    resumen: ReactNode
    /** Solo admin/manager: gráfico de compras a proveedores. */
    compras: ReactNode
    /** Solo admin/manager: costo vs precio de venta por producto. */
    margen: ReactNode
    /** Solo cliente (Soporte). undefined en el esqueleto. */
    telefonoAsesor?: string
}>) {
    if (role === "user") {
        return (
            <article className="flex flex-col gap-4">
                <PageHeader title="Dashboard" description="Compra perfiles en la Tienda y contacta a soporte si algo falla." />
                <ViewUser telefonoAsesor={telefonoAsesor} />
            </article>
        )
    }

    return (
        <article className="flex flex-col gap-4">
            <PageHeader title="Dashboard" description="Resumen general, compras a proveedores, márgenes y accesos rápidos." />
            {role === "error" ? (
                <p className="text-red-400" role="alert">Error al verificar tu sesión. Recarga la página o vuelve a iniciar sesión.</p>
            ) : (
                <>
                    {resumen}
                    {/* una debajo de la otra (pedido del usuario), en todos los anchos */}
                    {compras}
                    {margen}
                </>
            )}
        </article>
    )
}
