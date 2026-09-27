import type { Metadata } from "next"
import LoginForm from "@/app/login-form"

export const metadata: Metadata = {
  // La plantilla "%s · Playr" del layout raíz no se aplica a una página de su mismo segmento.
  title: { absolute: "Iniciar sesión · Playr" },
}

export default function Home() {
  return <LoginForm />
}
