import { type NextRequest, NextResponse } from "next/server"
import { createSupabaseConToken } from "@lib/supabase/middleware"
import { esFallaTransitoria, HINT_COOKIE, TOKEN_HEADER, VOLVER_COOKIE } from "@lib/sesion-tab"
import { cspHeader } from "@lib/csp"

// Cada pestaña manda el token de su propia sesión (ver @lib/sesion-tab): en el header
// si la petición es un fetch de la app, o en la cookie de paso si es una carga completa.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const hint = request.cookies.get(HINT_COOKIE)?.value
  const token = request.headers.get(TOKEN_HEADER) ?? hint ?? null

  const headers = new Headers(request.headers)
  if (token) headers.set(TOKEN_HEADER, token)
  else headers.delete(TOKEN_HEADER)

  // Nonce nuevo por petición: Next lo lee del header CSP de la petición y lo pone en sus scripts.
  const csp = cspHeader(btoa(crypto.randomUUID()))
  headers.set("Content-Security-Policy", csp)

  if (pathname.startsWith("/administrar")) {
    // getUser consulta a Supabase Auth: si la sesión se cerró porque la cuenta inició
    // sesión en otro lugar, falla aunque el token todavía no haya vencido.
    const { data, error } = token
      ? await createSupabaseConToken(token).auth.getUser(token)
      : { data: { user: null }, error: null }

    if (data.user?.role !== "authenticated") {
      if (esFallaTransitoria(error)) {
        console.error("proxy: no se pudo validar la sesión:", error?.message)
      }
      // El login decide: si la pestaña aún tiene sesión (token vencido), la renueva y
      // vuelve aquí; si la cerraron desde otro lugar, lo avisa.
      const response = NextResponse.redirect(new URL("/", request.url))
      response.cookies.set(VOLVER_COOKIE, `${pathname}${search}`, { path: "/", maxAge: 60, sameSite: "strict" })
      if (hint) response.cookies.delete(HINT_COOKIE)
      response.headers.set("Content-Security-Policy", csp)
      return response
    }
  }

  const response = NextResponse.next({ request: { headers } })
  // La cookie de paso se usa una sola vez.
  if (hint) response.cookies.delete(HINT_COOKIE)
  response.headers.set("Content-Security-Policy", csp)
  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
