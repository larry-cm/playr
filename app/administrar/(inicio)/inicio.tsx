import type { ReactNode } from "react"
import PageHeader from "@ui/page-header"

/** Inicio del panel según el rol. Lo comparten la página y su esqueleto (loading.tsx), así ambos miden lo mismo. */
export default function Inicio({ role, resumen, compras, margen }: Readonly<{
    role: string
    resumen: ReactNode
    /** Solo admin/manager: gráfico de compras a proveedores. */
    compras: ReactNode
    /** Solo admin/manager: costo vs precio de venta por producto. */
    margen: ReactNode
}>) {
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
