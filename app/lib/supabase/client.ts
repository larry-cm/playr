import { createBrowserClient } from "@supabase/ssr"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { supabaseUrl, supabaseKey } from "@lib/const"
import { STORAGE_KEY, TAB_ID_KEY } from "@lib/sesion-tab"

// Sin pestaña (p. ej. /reestablecer): sesión con cookies de Path=/, solo para ese flujo.
export const supabase = createBrowserClient(
  supabaseUrl!,
  supabaseKey!,
)

// sessionStorage puede no existir o lanzar (modo privado, almacenamiento bloqueado).
const almacenamiento = {
  getItem: (key: string) => {
    try {
      return sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem: (key: string, value: string) => {
    try {
      sessionStorage.setItem(key, value)
    } catch {
      // Sin almacenamiento la sesión dura lo que la página.
    }
  },
  removeItem: (key: string) => {
    try {
      sessionStorage.removeItem(key)
    } catch {
      // Nada que borrar.
    }
  },
}

type Mensaje = { tipo: "quien", tabId: string, de: string } | { tipo: "yo", para: string }

let lista: Promise<void> | null = null
let verificada = false

// Una pestaña duplicada copia el sessionStorage de la original (sesión incluida). Al
// cargar, la pestaña pregunta si otra ya usa su id: si la hay, es la copia y empieza sin
// sesión. Hasta resolverlo no se toca la sesión, así la copia no rota el refresh token.
function verificar(): Promise<void> {
  let tabId = almacenamiento.getItem(TAB_ID_KEY)
  const idNuevo = () => {
    tabId = crypto.randomUUID()
    almacenamiento.setItem(TAB_ID_KEY, tabId)
  }
  const listo = () => { verificada = true }

  if (!tabId || typeof BroadcastChannel === "undefined") {
    if (!tabId) idNuevo()
    listo()
    return Promise.resolve()
  }

  // El canal queda abierto mientras viva la página: así responde a sus copias.
  const canal = new BroadcastChannel("playr-pestanas")
  const yo = crypto.randomUUID()
  return new Promise((resolve) => {
    const espera = setTimeout(() => {
      listo()
      resolve()
    }, 250)
    canal.onmessage = ({ data }: MessageEvent<Mensaje>) => {
      if (data.tipo === "quien" && verificada && data.tabId === tabId) {
        canal.postMessage({ tipo: "yo", para: data.de } satisfies Mensaje)
      }
      if (data.tipo === "yo" && data.para === yo && !verificada) {
        clearTimeout(espera)
        almacenamiento.removeItem(STORAGE_KEY)
        idNuevo()
        listo()
        resolve()
      }
    }
    canal.postMessage({ tipo: "quien", tabId: tabId!, de: yo } satisfies Mensaje)
  })
}

export const pestanaLista = () => (lista ??= verificar())

let cliente: SupabaseClient | null = null

// Cliente de la sesión de esta pestaña: vive en su sessionStorage (ver @lib/sesion-tab).
export const supabaseTab = () => {
  cliente ??= createClient(supabaseUrl!, supabaseKey!, {
    auth: {
      storage: almacenamiento,
      storageKey: STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  })
  return cliente
}

// Cliente de la pestaña una vez descartado que sea una copia de otra.
export const supabaseTabListo = async () => {
  await pestanaLista()
  return supabaseTab()
}

// Token vigente de la pestaña (lo refresca si venció), o null sin sesión.
export const tokenTab = async () => {
  const { data } = await (await supabaseTabListo()).auth.getSession()
  return data.session?.access_token ?? null
}

// Lectura sincrónica del token guardado (para beforeunload, que no puede esperar).
export const tokenGuardado = () => {
  if (!verificada) return null
  const raw = almacenamiento.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return (JSON.parse(raw) as { access_token?: string }).access_token ?? null
  } catch {
    return null
  }
}
