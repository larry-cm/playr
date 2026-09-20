import { createSupabase } from "@lib/supabase/server"

export async function getRoleUser(): Promise<"user" | "admin" | "manager" | "error"> {
    const supabase = await createSupabase()
    const { data: auth, error } = await supabase.auth.getUser()
    if (error || !auth.user) return "error"

    const { data } = await supabase
        .schema("security")
        .from("user_role")
        .select("role:role_id(nombre)")
        .eq("auth_user_id", auth.user.id)
        .maybeSingle<{ role: { nombre: string } | null }>()

    const nombre = data?.role?.nombre
    // Antes caía a "admin" si faltaba el dato; default seguro ahora es "user" (mínimo privilegio).
    return nombre === "admin" || nombre === "manager" || nombre === "user" ? nombre : "user"
}