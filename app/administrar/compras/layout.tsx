import type { Metadata } from "next"
import { redirect } from "next/navigation"
import PageHeader from "@ui/page-header"
import { getRoleUser } from "@action/get-role-action"

export const metadata: Metadata = {
  title: "Mis compras",
}

// El encabezado vive en el layout: se ve igual mientras carga la página (loading.tsx) y no se vuelve a pintar al llegar los datos.
export default async function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  const role = await getRoleUser()
  if (role !== "user") redirect("/administrar")

  return (
    <section className="flex flex-col gap-4">
      <PageHeader title="Mis compras" description="Tus pedidos y, cuando el pago esté aprobado, los datos de acceso de tus cuentas." />
      {children}
    </section>
  )
}
