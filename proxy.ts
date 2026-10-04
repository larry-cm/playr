import { type NextRequest, NextResponse } from "next/server"
import { isAuthRetryableFetchError } from "@supabase/supabase-js"
import { createClient } from "@/app/lib/supabase/middleware"
import { leerRutaTab, SID_HEADER } from "@lib/sesion-tab"

// Cada pestaña vive bajo /s/<sid>/... con su propia sesión (ver @lib/sesion-tab):
// aquí se valida esa sesión y se reescribe a la ruta real, pasando el sid en un header.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const tab = leerRutaTab(pathname)

  // /administrar sin pestaña no tiene sesión: al login.
  // El header del sid solo lo pone este proxy, nunca el navegador.
  if (!tab) {
    if (pathname.startsWith("/administrar")) return NextResponse.redirect(new URL("/", request.url))
    const headers = new Headers(request.headers)
    headers.delete(SID_HEADER)
    return NextResponse.next({ request: { headers } })
  }

  const { supabase, cookiesToSet } = createClient(request, tab.sid)
  // getUser consulta a Supabase Auth: si la sesión se cerró porque la cuenta inició
  // sesión en otro lugar, falla aunque el token todavía no haya vencido.
  // supabase-js reporta esa sesión cerrada igual que la falta de sesión: se distingue
  // porque la pestaña sí traía su cookie.
  const traiaSesion = request.cookies.getAll().some(({ name }) => name.startsWith(`sb-${tab.sid}`))
  const { data, error } = await supabase.auth.getUser()
  const isAuthorized = data.user?.role === "authenticated"

  if (tab.resto.startsWith("/administrar") && !isAuthorized) {
    const login = new URL("/", request.url)
    // Una caída de red o de Supabase Auth no es "otra sesión": no se muestra ese aviso.
    const fallaTransitoria = !!error && (isAuthRetryableFetchError(error) || (error.status ?? 0) >= 500 || error.status === 429)
    if (fallaTransitoria) console.error("proxy: no se pudo validar la sesión:", error.message)
    else if (traiaSesion) login.searchParams.set("sesion", "cerrada")
    const response = NextResponse.redirect(login)
    // Si Supabase borró la sesión vencida, la cookie también se borra en el navegador.
    cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
    return response
  }

  const headers = new Headers(request.headers)
  headers.set(SID_HEADER, tab.sid)
  const response = NextResponse.rewrite(new URL(`${tab.resto}${search}`, request.url), {
    request: { headers },
  })
  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
