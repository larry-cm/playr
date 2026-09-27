import type { Metadata } from "next"
import PageHeader from "@ui/page-header"

export const metadata: Metadata = {
  title: "Perfiles",
}

// El encabezado vive en el layout: se ve igual mientras carga la página (loading.tsx) y no se vuelve a pintar al llegar los datos.
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <section className="flex flex-col gap-4">
      <PageHeader title="Perfiles" description="Las pantallas que se venden, una por fila. Cambia su estado para sacarlas o devolverlas a la Tienda." />
      {children}
    </section>
  )
}
