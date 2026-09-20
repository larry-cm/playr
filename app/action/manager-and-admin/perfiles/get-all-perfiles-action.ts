"use server"

import type { SimpleAccessType } from "@lib/access-type"

export interface PerfilRow {
    id: number
    account_id: number
    platform_nombre: string
    access_type: SimpleAccessType
    cuenta_email: string
    nombre_perfil: string
    pin: string | null
    estado: "disponible" | "vendido" | "suspendido" | "en_soporte"
    fecha_vencimiento: string | null
}

type AccountEmbed = {
    id: number
    email: string
    access_type: SimpleAccessType
    fecha_vencimiento: string | null
    platform: { nombre: string } | null
}

/**
 * Un perfil es la pantalla individual que se vende. Siempre cuelga de una cuenta comprada
 * (business.account), así que este módulo nunca los inventa: muestra y gestiona lo que entró por
 * una compra al proveedor.
 *
 * El !inner sobre account no es decorativo: sin él PostgREST rechaza el filtro "account.exist"
 * con PGRST108 y la lista incluiría perfiles de cuentas ya eliminadas.
 * password_enc de la cuenta nunca se selecciona: esta pantalla no descifra ni muestra contraseñas.
 */
export async function getAllPerfilesAction(): Promise<PerfilRow[] | null> {
    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    try {
        const { data, error } = await supabase
            .schema("business")
            .from("profile")
            .select("id,account_id,nombre_perfil,pin,estado,account:account_id!inner(id,email,access_type,fecha_vencimiento,exist,platform:platform_id(nombre))")
            .eq("exist", true)
            .eq("account.exist", true)
            .order("account_id", { ascending: true })
            .order("id", { ascending: true })

        if (error) return null

        return data.map((row) => {
            const account = row.account as unknown as AccountEmbed | null
            return {
                id: row.id,
                account_id: row.account_id,
                platform_nombre: account?.platform?.nombre ?? "--",
                access_type: account?.access_type ?? "pantalla",
                cuenta_email: account?.email ?? "--",
                nombre_perfil: row.nombre_perfil,
                pin: row.pin,
                estado: row.estado,
                fecha_vencimiento: account?.fecha_vencimiento ?? null,
            }
        })
    } catch {
        return []
    }
}
