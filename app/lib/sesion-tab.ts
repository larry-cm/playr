import { isAuthError, isAuthRetryableFetchError } from "@supabase/supabase-js"

// Cada pestaña tiene su propia sesión, sin que se note en la URL. La sesión vive en el
// sessionStorage de la pestaña (lo comparte solo con ella) y viaja al servidor así:
// - fetch de la app (navegación, server actions): header TOKEN_HEADER (app/sesion-fetch.tsx).
// - carga completa (recargar, escribir la URL): la pestaña deja HINT_COOKIE al salir, que
//   dura unos segundos y proxy.ts consume en la siguiente petición.
// proxy.ts valida el token y lo deja en TOKEN_HEADER para el servidor (@lib/supabase/server).

export const TOKEN_HEADER = "x-playr-token"
export const HINT_COOKIE = "playr-tab-token"
export const HINT_SEGUNDOS = 10

// Clave de la sesión de Supabase en el sessionStorage de la pestaña.
export const STORAGE_KEY = "playr-sesion"
// Id de la pestaña, para detectar una pestaña duplicada (copia el sessionStorage).
export const TAB_ID_KEY = "playr-tab-id"

// Caída de red o de Supabase Auth (5xx, límite de peticiones): no dice nada de la sesión,
// así que no se borra ni se avisa "inició sesión en otro lugar".
export const esFallaTransitoria = (error: unknown) =>
    isAuthRetryableFetchError(error)
    || (isAuthError(error) && ((error.status ?? 0) >= 500 || error.status === 429))

// Ruta que pedía la pestaña cuando proxy.ts la mandó al login (cookie, para no ensuciar la URL).
export const VOLVER_COOKIE = "playr-volver"

// Ruta a donde volver tras recuperar la sesión en el login: solo rutas internas.
export const rutaSegura = (value: string | null | undefined) =>
    value && value.startsWith("/administrar") ? value : "/administrar"
