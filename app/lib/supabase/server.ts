import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies, headers } from "next/headers"
import { supabaseUrl, supabaseKey } from "@lib/const"
import { TOKEN_HEADER } from "@lib/sesion-tab"
import { createSupabaseConToken } from "@lib/supabase/middleware"


const esVerificador = (name: string) => name.endsWith("-code-verifier")

// Sin sesión de pestaña: cliente anónimo. Solo pasa el code verifier (PKCE) que deja
// "olvidé mi contraseña" para /reestablecer.
const createAnonimo = (cookieStore: Awaited<ReturnType<typeof cookies>>) => createServerClient(
  supabaseUrl!,
  supabaseKey!,
  {
    cookies: {
      getAll() {
        return cookieStore.getAll().filter(({ name }) => esVerificador(name))
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet
            .filter(({ name }) => esVerificador(name))
            .forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // The `setAll` method was called from a Server Component.
        }
      },
    },
  },
) as SupabaseClient

// Token de la sesión de la pestaña que hace la petición (ver @lib/sesion-tab).
export const getToken = async () => (await headers()).get(TOKEN_HEADER)

export const createSupabase = async () => {
  const token = await getToken()
  return token ? createSupabaseConToken(token) : createAnonimo(await cookies())
}

// Usuario de la pestaña, validado contra Supabase Auth (detecta sesiones cerradas).
export const getUsuario = async () => {
  const token = await getToken()
  if (!token) return { user: null, supabase: await createSupabase() }
  const supabase = createSupabaseConToken(token)
  const { data, error } = await supabase.auth.getUser(token)
  return { user: error ? null : data.user, supabase }
}

// Las rutas ya no llevan prefijo de pestaña: se conserva la firma para quien la usa.
export const rutaServidor = async (path: string) => path
