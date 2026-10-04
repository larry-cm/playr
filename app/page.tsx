import type { Metadata } from "next"
import { cookies } from "next/headers"
import LoginForm from "@/app/login-form"
import { rutaSegura, VOLVER_COOKIE } from "@lib/sesion-tab"

export const metadata: Metadata = {
  // La plantilla "%s · Playr" del layout raíz no se aplica a una página de su mismo segmento.
  title: { absolute: "Iniciar sesión · Playr" },
}

// Si proxy.ts mandó la pestaña aquí desde una ruta del panel, la deja en VOLVER_COOKIE.
export default async function Home() {
  const volver = (await cookies()).get(VOLVER_COOKIE)?.value
  return <LoginForm volver={volver ? rutaSegura(volver) : undefined} />
}
