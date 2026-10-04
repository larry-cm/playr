import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { supabaseUrl, supabaseKey } from "@lib/const"
import { cookieOptionsTab } from "@lib/sesion-tab"

// Sin pestaña (p. ej. /reestablecer): sesión con cookies de Path=/, solo para ese flujo.
export const supabase = createBrowserClient(
  supabaseUrl!,
  supabaseKey!,
)

const porPestana = new Map<string, SupabaseClient>()

// Cliente de la pestaña <sid>: lee y escribe solo sus cookies (ver @lib/sesion-tab).
export const supabaseTab = (sid: string) => {
  let cliente = porPestana.get(sid)
  if (!cliente) {
    cliente = createBrowserClient(supabaseUrl!, supabaseKey!, {
      cookieOptions: cookieOptionsTab(sid),
      isSingleton: false,
    })
    porPestana.set(sid, cliente)
  }
  return cliente
}
