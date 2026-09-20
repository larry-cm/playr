"use server"

import type { SimpleAccessType } from "@lib/access-type"

export interface CuentaRow {
    id: number
    platform_id: number
    platform_nombre: string
    access_type: SimpleAccessType
    email: string
    perfil_max: number
    perfiles_total: number
    perfiles_disponibles: number
    fecha_vencimiento: string | null
    costo: number | null
}

type ProfileEmbed = { id: number; estado: string; exist: boolean }

/**
 * Una cuenta es el login real comprado al proveedor: pertenece a UNA plataforma y agrupa los
 * perfiles que se venden por separado (ver /administrar/perfiles). Hoy casi todas traen un solo
 * perfil porque se compran de a uno (ver create-producto-action.ts y business.registrar_licencias),
 * pero acá se cuentan los perfiles como lista: la pantalla tiene que servir igual con 1 o con 5.
 *
 * password_enc nunca se selecciona: esta pantalla no descifra ni muestra contraseñas.
 */
export async function getAllCuentasAction(): Promise<CuentaRow[] | null> {
    const { createSupabase } = await import("@lib/supabase/server")
    const supabase = await createSupabase()
    try {
        const { data, error } = await supabase
            .schema("business")
            .from("account")
            .select("id,platform_id,access_type,email,perfil_max,fecha_vencimiento,costo,platform:platform_id(nombre),profile(id,estado,exist)")
            .eq("exist", true)
            .order("platform_id", { ascending: true })
            .order("id", { ascending: true })

        if (error) return null

        return data.map((row) => {
            const platform = row.platform as unknown as { nombre: string } | null
            // El embed trae también los perfiles borrados (exist=false): se filtran acá porque
            // PostgREST no admite condiciones sobre un recurso embebido sin volverlo inner join.
            const perfiles = ((row.profile as unknown as ProfileEmbed[] | null) ?? []).filter((p) => p.exist)
            return {
                id: row.id,
                platform_id: row.platform_id,
                platform_nombre: platform?.nombre ?? "--",
                access_type: row.access_type,
                email: row.email,
                perfil_max: row.perfil_max,
                perfiles_total: perfiles.length,
                perfiles_disponibles: perfiles.filter((p) => p.estado === "disponible").length,
                fecha_vencimiento: row.fecha_vencimiento,
                costo: row.costo,
            }
        })
    } catch {
        return []
    }
}
