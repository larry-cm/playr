import { createSupabase } from "@lib/supabase/server"
import { createSupabaseAdmin } from "@lib/supabase/admin"

export interface Aviso {
    origen: "scraping" | "plataforma"
    tipo: "error" | "advertencia" | "info" | "exito"
    titulo: string
    /** Texto, o lo capturado en un catch (se toma su .message). */
    mensaje: unknown
}

/**
 * Deja un aviso en la bandeja (campana) de admin/manager vía business.notificar, que además descarta el
 * repetido si ya hay uno igual sin eliminar. Solo para fallas que requieren atención humana, no para
 * eventos normales. Nunca lanza: reportar una falla no puede provocar otra.
 */
export async function notificar({ origen, tipo, titulo, mensaje }: Aviso): Promise<void> {
    try {
        // business.notificar solo inserta para staff o service_role: con la clave secreta avisa aunque la
        // falla ocurra en una acción de un cliente (p. ej. la Tienda). Sin ella, usa la sesión actual.
        const supabase = createSupabaseAdmin() ?? (await createSupabase())
        const { error } = await supabase.schema("business").rpc("notificar", {
            p_origen: origen,
            p_tipo: tipo,
            p_titulo: titulo,
            p_mensaje: mensaje instanceof Error ? mensaje.message : String(mensaje),
        })
        if (error) console.error("notificar: no se pudo registrar el aviso:", error.message)
    } catch (e) {
        console.error("notificar: no se pudo registrar el aviso:", e)
    }
}
