import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/app/lib/supabase/middleware"

export async function proxy(request: NextRequest, next: (request: NextRequest) => Promise<Response>) {
  const { supabase, supabaseResponse } = createClient(request)

  const { data, error } = await supabase.auth.getUser()
  const pathManager = request.nextUrl.pathname.startsWith("/administrar")
  const isAuthorized = data.user?.role === "authenticated"

  if (pathManager && !isAuthorized) {
    return NextResponse.redirect(new URL("/", request.url))
  }
  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
