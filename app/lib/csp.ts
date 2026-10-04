import { supabaseUrl } from "@lib/const"

const isDev = process.env.NODE_ENV !== "production"

// El navegador solo habla con la propia app y con Supabase (REST/Auth, Realtime por WebSocket y Storage para los
// comprobantes firmados). Las fuentes de next/font se sirven desde el propio dominio; los enlaces a wa.me son
// navegaciones y no pasan por CSP.
const supabaseOrigin = (() => {
  try {
    return new URL(supabaseUrl ?? "").origin
  } catch {
    return ""
  }
})()
const supabaseWs = supabaseOrigin.replace(/^http/, "ws")

/**
 * CSP con nonce por petición (lo genera proxy.ts y Next lo pone en sus propios scripts): un script inyectado no corre
 * aunque aparezca un XSS, y por eso no puede leer la sesión de la pestaña (sessionStorage). Las imágenes solo salen
 * del propio dominio y de Supabase, así no sirven para sacar datos a otro servidor.
 */
export function cspHeader(nonce: string): string {
  return [
    "default-src 'self'",
    // React en desarrollo usa eval.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    `img-src 'self' data: blob: ${supabaseOrigin}`.trim(),
    // Notas de voz del chat: la vista previa local (blob:) y los audios firmados de Supabase Storage.
    `media-src 'self' blob: ${supabaseOrigin}`.trim(),
    // blob:: la forma de onda de la nota de voz se lee con fetch, también la de la vista previa antes de enviarla.
    `connect-src 'self' blob: ${supabaseOrigin} ${supabaseWs}`.trim(),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ")
}
