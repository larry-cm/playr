import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { rutaServidor } from "@lib/supabase/server"
import PageHeader from "@ui/page-header"
import { getRoleUser } from "@action/get-role-action"

export const metadata: Metadata = {
  title: "Clientes",
}

// El encabezado vive en el layout: se ve igual mientras carga la página (loading.tsx) y no se vuelve a pintar al llegar los datos.
// El rol se revisa acá (no solo en page.tsx): el layout envuelve a loading.tsx, así nadie ve la pantalla de otro rol mientras carga.
export default async function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  const role = await getRoleUser()
  if (role !== "admin" && role !== "manager") redirect(await rutaServidor("/administrar"))

  return (
    <section className="flex flex-col gap-4">
      <PageHeader title="Clientes" description="Usuarios registrados en la plataforma." />
      {children}
    </section>
  )
}
