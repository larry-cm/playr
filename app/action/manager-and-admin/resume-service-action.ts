import { createSupabase } from "@lib/supabase/server"

export async function resumeServicesAction() {
    const supabase = await createSupabase()

    const [clients, accountsWithProfiles, profiles] = await Promise.all([
        supabase.schema("security").from("client").select("id", { count: "exact", head: true }).eq("exist", true),
        // Cuentas = logins que agrupan VARIOS perfiles de UNA plataforma (ver /administrar/cuentas y
        // get-all-cuentas-action.ts). Una cuenta con un solo perfil vivo es un perfil comprado suelto,
        // no una cuenta, así que este conteo necesita la lista completa (PostgREST no puede filtrar
        // por "cantidad de perfiles embebidos > 1" con head:true). Un combo no cuenta acá: no es una
        // cuenta sino un producto que agrupa cuentas/perfiles de varias plataformas.
        supabase
            .schema("business")
            .from("account")
            .select("id,profile(id,exist)")
            .eq("exist", true),
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

    const accountsCount = (accountsWithProfiles.data ?? []).filter(
        (row) => ((row.profile as unknown as { id: number; exist: boolean }[] | null) ?? []).filter((p) => p.exist).length > 1
    ).length

    return {
        customers: clients.count ?? 0,
        accounts: accountsWithProfiles.error ? 0 : accountsCount,
        profiles: profiles.count ?? 0,
    }
}
