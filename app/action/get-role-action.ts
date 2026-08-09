import { createSupabase } from "@lib/supabase/server"

export async function getRoleUser(): Promise<"user" | "admin" | "manager" | "error"> {
    const supabase = await createSupabase()
    const { data, error } = await supabase.auth.getUser()
    const user = data.user

    if (error || !user) return "error"
    return user.user_metadata.role || "admin"
}