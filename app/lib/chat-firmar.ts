// Solo servidor. Enlaces a los adjuntos del chat con el cliente de Supabase de quien llama, así la RLS de storage
// decide qué puede ver: 'chat' y 'comprobantes' (privados: dueño y staff) con enlaces temporales; 'llaves-qr' es público
// (su lectura por la API es solo del admin, así que no se firma: se da la URL pública).
import type { SupabaseClient } from "@supabase/supabase-js"
import type { BucketAdjunto, TipoAdjunto } from "@lib/chat-adjunto"

/** El chat consulta cada 5 s; el navegador conserva el enlace de cada mensaje mientras siga abierto. */
const VALIDEZ_S = 60 * 60

type ConAdjunto = { adjunto_path: string | null; adjunto_tipo: TipoAdjunto | null; adjunto_bucket: BucketAdjunto }

/** Cambia la ruta interna del adjunto por un enlace (null si no se pudo firmar, p. ej. archivo borrado: se muestra "no disponible"). */
export async function firmarAdjuntos<T extends ConAdjunto>(
    supabase: SupabaseClient,
    mensajes: T[],
): Promise<(Omit<T, "adjunto_path"> & { adjunto_url: string | null })[]> {
    const urls = new Map<string, string>()
    const clave = (bucket: string, path: string) => `${bucket}/${path}`
    await Promise.all(
        (["chat", "comprobantes", "llaves-qr"] as const).map(async (bucket) => {
            const rutas = [...new Set(mensajes.flatMap((m) => (m.adjunto_path && m.adjunto_bucket === bucket ? [m.adjunto_path] : [])))]
            if (!rutas.length) return
            if (bucket === "llaves-qr") {
                for (const r of rutas) urls.set(clave(bucket, r), supabase.storage.from(bucket).getPublicUrl(r).data.publicUrl)
                return
            }
            const { data, error } = await supabase.storage.from(bucket).createSignedUrls(rutas, VALIDEZ_S)
            if (error) console.error(`firmarAdjuntos (${bucket}):`, error.message)
            for (const f of data ?? []) if (f.path && f.signedUrl) urls.set(clave(bucket, f.path), f.signedUrl)
        }),
    )
    return mensajes.map(({ adjunto_path, ...m }) => ({ ...m, adjunto_url: adjunto_path ? (urls.get(clave(m.adjunto_bucket, adjunto_path)) ?? null) : null }))
}
