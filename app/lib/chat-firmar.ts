// Solo servidor. Enlaces temporales a los adjuntos del chat (bucket privado 'chat'); con el cliente de Supabase de quien
// llama, así la RLS de storage decide qué puede ver.
import type { SupabaseClient } from "@supabase/supabase-js"
import type { TipoAdjunto } from "@lib/chat-adjunto"

/** El chat consulta cada 5 s; el navegador conserva el enlace de cada mensaje mientras siga abierto. */
const VALIDEZ_S = 60 * 60

type ConAdjunto = { adjunto_path: string | null; adjunto_tipo: TipoAdjunto | null }

/** Cambia la ruta interna del adjunto por un enlace (null si no se pudo firmar: se muestra "no disponible"). */
export async function firmarAdjuntos<T extends ConAdjunto>(
    supabase: SupabaseClient,
    mensajes: T[],
): Promise<(Omit<T, "adjunto_path"> & { adjunto_url: string | null })[]> {
    const rutas = [...new Set(mensajes.flatMap((m) => (m.adjunto_path ? [m.adjunto_path] : [])))]
    const urls = new Map<string, string>()
    if (rutas.length) {
        const { data, error } = await supabase.storage.from("chat").createSignedUrls(rutas, VALIDEZ_S)
        if (error) console.error("firmarAdjuntos:", error.message)
        for (const f of data ?? []) if (f.path && f.signedUrl) urls.set(f.path, f.signedUrl)
    }
    return mensajes.map(({ adjunto_path, ...m }) => ({ ...m, adjunto_url: adjunto_path ? (urls.get(adjunto_path) ?? null) : null }))
}
