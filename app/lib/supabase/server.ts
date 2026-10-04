import { createServerClient } from "@supabase/ssr"
import { cookies, headers } from "next/headers"
import { supabaseUrl, supabaseKey } from "@lib/const"
import { cookieOptionsTab, esSid, rutaTab, SID_HEADER } from "@lib/sesion-tab"


const esVerificador = (name: string) => name.endsWith("-code-verifier")

const createClient =
  (cookieStore: Awaited<ReturnType<typeof cookies>>, sid: string | null) => createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      ...(sid ? { cookieOptions: cookieOptionsTab(sid) } : {}),
      cookies: {
        // Fuera de una pestaña (/s/<sid>/...) no hay sesión: cliente anónimo. Solo pasa
        // el code verifier (PKCE) que deja "olvidé mi contraseña" para /reestablecer.
        getAll() {
          return sid ? cookieStore.getAll() : cookieStore.getAll().filter(({ name }) => esVerificador(name))
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet
              .filter(({ name }) => sid || esVerificador(name))
              .forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  )

// El sid de la pestaña lo pone proxy.ts al reescribir /s/<sid>/... (ver @lib/sesion-tab).
export const getSid = async () => {
  const sid = (await headers()).get(SID_HEADER)
  return esSid(sid) ? sid : null
}

// Ruta interna con el prefijo de la pestaña actual, para redirect() en el servidor.
export const rutaServidor = async (path: string) => {
  const sid = await getSid()
  return sid ? rutaTab(sid, path) : "/"
}

export const createSupabase = async () => createClient(await cookies(), await getSid())

// Para el login: la pestaña todavía no tiene sesión y su sid llega en el formulario.
export const createSupabaseTab = async (sid: string) => createClient(await cookies(), sid)
