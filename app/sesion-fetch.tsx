"use client"

import { HINT_COOKIE, HINT_SEGUNDOS, TOKEN_HEADER } from "@lib/sesion-tab"
import { pestanaLista, tokenGuardado, tokenTab } from "@lib/supabase/client"

// Cada petición de la app a su propio servidor (navegación, server actions) lleva el
// token de la sesión de esta pestaña (ver @lib/sesion-tab). Se instala al cargar el
// módulo, antes de que el router de Next haga su primer fetch.
function instalar() {
    // Desde la carga: detecta si esta pestaña es una copia y responde a sus copias.
    void pestanaLista()

    const original = window.fetch.bind(window)

    window.fetch = async (input, init) => {
        const url = new URL(input instanceof Request ? input.url : String(input), window.location.href)
        // Nunca a otro origen (Supabase incluido): el token no sale del sitio.
        if (url.origin !== window.location.origin) return original(input, init)

        const token = await tokenTab()
        if (!token) return original(input, init)

        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
        headers.set(TOKEN_HEADER, token)
        return original(input, { ...init, headers })
    }

    // Una carga completa (recargar, escribir la URL) no lleva headers: la pestaña deja
    // su token unos segundos en una cookie que proxy.ts consume y borra. beforeunload y no
    // pagehide: el navegador pide la página nueva antes de disparar pagehide.
    window.addEventListener("beforeunload", () => {
        const token = tokenGuardado()
        if (!token) return
        const seguro = window.location.protocol === "https:" ? "; secure" : ""
        document.cookie = `${HINT_COOKIE}=${token}; path=/; max-age=${HINT_SEGUNDOS}; samesite=strict${seguro}`
    })
    // Cuando llega pagehide, la petición de la página nueva ya salió (con la cookie). Si la
    // pestaña se cerró o fue a otro sitio, nadie la usó: se borra para que otra pestaña
    // no la tome.
    window.addEventListener("pagehide", () => {
        document.cookie = `${HINT_COOKIE}=; path=/; max-age=0; samesite=strict`
    })
}

if (typeof window !== "undefined" && !(window as { __playrFetch?: boolean }).__playrFetch) {
    (window as { __playrFetch?: boolean }).__playrFetch = true
    instalar()
}

export default function SesionFetch() {
    return null
}
