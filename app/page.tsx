import type { Metadata } from "next"
import LoginForm from "@/app/login-form"

export const metadata: Metadata = {
  // La plantilla "%s · Playr" del layout raíz no se aplica a una página de su mismo segmento.
  title: { absolute: "Iniciar sesión · Playr" },
}

// ?sesion=cerrada: proxy.ts encontró la sesión cerrada porque la cuenta entró en otro lugar.
export default async function Home({ searchParams }: Readonly<{ searchParams: Promise<{ sesion?: string }> }>) {
  const { sesion } = await searchParams
  return <LoginForm sesionCerrada={sesion === "cerrada"} />
}
