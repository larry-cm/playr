import { createClient } from "@supabase/supabase-js"
import { supabaseUrl, supabaseKey } from "@lib/const"

// Cliente con el token de una pestaña (ver @lib/sesion-tab): la RLS ve a ese usuario.
// Nunca refresca la sesión (eso lo hace la pestaña), así dos peticiones no se pisan el
// refresh token. Sin next/headers: lo usa también proxy.ts.
export const createSupabaseConToken = (token: string) => createClient(supabaseUrl!, supabaseKey!, {
  global: { headers: { Authorization: `Bearer ${token}` } },
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
