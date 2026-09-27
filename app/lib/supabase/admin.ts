import { createClient } from "@supabase/supabase-js"
import { supabaseUrl } from "@lib/const"

/**
 * Cliente con la clave secreta del proyecto (rol service_role: ignora RLS). SOLO en el servidor y solo
 * después de verificar el rol de quien llama. Se usa para lo que ningún usuario puede hacer por sí mismo:
 * crear usuarios (el registro público está cerrado), asignar roles y dejar avisos en la campana.
 * null = falta SUPABASE_SECRET_KEY en el entorno.
 */
export function createSupabaseAdmin() {
    if (typeof window !== "undefined") throw new Error("createSupabaseAdmin solo corre en el servidor")
    const key = process.env.SUPABASE_SECRET_KEY
    if (!supabaseUrl || !key) return null
    return createClient(supabaseUrl, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
}
