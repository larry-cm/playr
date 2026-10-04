import { createServerClient } from "@supabase/ssr"
import type { NextRequest } from "next/server"
import { supabaseUrl, supabaseKey } from "@lib/const"
import { cookieOptionsTab } from "@lib/sesion-tab"

type CookieToSet = { name: string, value: string, options: Record<string, unknown> }

// Cliente de la pestaña <sid>. Las cookies que refresca se guardan en `request`
// (para lo que se renderiza después en esta misma petición) y en `cookiesToSet`
// (para copiarlas a la respuesta que arme proxy.ts).
export const createClient = (request: NextRequest, sid: string) => {
  const cookiesToSet: CookieToSet[] = []

  const supabase = createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookieOptions: cookieOptionsTab(sid),
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(nuevas) {
          nuevas.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            cookiesToSet.push({ name, value, options })
          })
        },
      },
    },
  )

  return { supabase, cookiesToSet }
}
