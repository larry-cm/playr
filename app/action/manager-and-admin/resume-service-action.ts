import { createSupabase } from "@lib/supabase/server"

export async function resumeServicesAction() {
    const supabase = await createSupabase()

    const [clients, accounts, profiles] = await Promise.all([
        supabase.schema("security").from("client").select("id", { count: "exact", head: true }).eq("exist", true),
        // Cuentas = los logins reales comprados al proveedor, de cualquier tipo de acceso: cada uno
        // agrupa los perfiles de UNA plataforma (ver /administrar/cuentas). Un combo no cuenta acá:
        // no es una cuenta sino un producto que agrupa cuentas/perfiles de varias plataformas.
        supabase.schema("business").from("account").select("id", { count: "exact", head: true }).eq("exist", true),
        // Perfiles = las pantallas vendibles vivas (ver /administrar/perfiles). El !inner es necesario:
        // sin él, PostgREST rechaza el filtro "account.exist" con PGRST108 ("no es un recurso
        // embebido") y el contador quedaba siempre en 0.
        supabase
            .schema("business")
            .from("profile")
            .select("id,account:account_id!inner(exist)", { count: "exact", head: true })
            .eq("exist", true)
            .eq("account.exist", true),
    ])

    return {
        customers: clients.count ?? 0,
        accounts: accounts.count ?? 0,
        profiles: profiles.count ?? 0,
    }
}
