import type { CookieOptionsWithName } from "@supabase/ssr"

// Cada pestaña tiene su propia sesión. La pestaña vive bajo /s/<sid>/... y sus
// cookies de Supabase se llaman sb-<sid> con Path=/s/<sid>: el navegador solo las
// manda a esa pestaña, así dos pestañas pueden tener cuentas distintas. proxy.ts
// reescribe /s/<sid>/administrar/... a /administrar/... y pasa el sid en un header.

export const SID_HEADER = "x-playr-sid"
export const SID_STORAGE_KEY = "playr-sid"

const SID_RE = /^[0-9a-f]{32}$/

export const esSid = (value: unknown): value is string =>
    typeof value === "string" && SID_RE.test(value)

export const nuevoSid = () => crypto.randomUUID().replaceAll("-", "")

export const prefijoTab = (sid: string) => `/s/${sid}`

// "/administrar/clientes" → "/s/<sid>/administrar/clientes"
export const rutaTab = (sid: string, path: string) => `${prefijoTab(sid)}${path}`

// Separa "/s/<sid>/resto" en sid y resto; null si la URL no es de una pestaña.
export const leerRutaTab = (pathname: string) => {
    const match = /^\/s\/([^/]+)(\/.*)?$/.exec(pathname)
    if (!match || !esSid(match[1])) return null
    return { sid: match[1], resto: match[2] ?? "/" }
}

export const cookieOptionsTab = (sid: string): CookieOptionsWithName => ({
    name: `sb-${sid}`,
    path: prefijoTab(sid),
})
