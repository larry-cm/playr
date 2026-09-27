"use server"

import { esStaff } from "@lib/auth"
import { createSupabase } from "@lib/supabase/server"

export interface NotificacionRow {
    id: number
    origen: "scraping" | "plataforma"
    tipo: "error" | "advertencia" | "info" | "exito"
    titulo: string
    mensaje: string
    created_at: string
}

// Solo admin/manager ven filas (RLS de business.notificacion): para otro rol devuelve [].
// ponytail: las 100 más recientes, y buscar/filtrar se hace en el cliente. Paginar y filtrar en el servidor si la bandeja crece.
export async function getNotificacionesAction(): Promise<NotificacionRow[] | null> {
    if (!(await esStaff())) return null

    const supabase = await createSupabase()
    try {
        const { data, error } = await supabase
            .schema("business")
            .from("notificacion")
            .select("id,origen,tipo,titulo,mensaje,created_at")
            .eq("exist", true)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .limit(100)

        if (error) return null
        return data
    } catch {
        return null
    }
}
