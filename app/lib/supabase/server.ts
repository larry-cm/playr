import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { supabaseUrl, supabaseKey } from "@lib/const"


const createClient =
  (cookieStore: Awaited<ReturnType<typeof cookies>>) => createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  )


export const createSupabase = async () => createClient(await cookies())
