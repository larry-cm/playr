import { createSupabase } from "@lib/supabase/server"

export async function resumeServicesAction() {
    const supabase = await createSupabase()

    const [clients, accounts, profiles] = await Promise.all([
        supabase.schema("security").from("client").select("id", { count: "exact", head: true }).eq("exist", true),
        supabase.schema("business").from("account").select("id", { count: "exact", head: true }).eq("exist", true),
        supabase.schema("business").from("profile").select("id", { count: "exact", head: true }).eq("account.exist", true),
    ])

    return {
        customers: clients.count ?? 0,
        accounts: accounts.count ?? 0,
        profiles: profiles.count ?? 0,
    }
}