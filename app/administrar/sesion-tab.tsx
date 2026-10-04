"use client"

import { createContext, useContext, useEffect } from "react"
import { rutaTab, SID_STORAGE_KEY } from "@lib/sesion-tab"
import { supabaseTab } from "@lib/supabase/client"

// Sesión de esta pestaña (ver @lib/sesion-tab). Los componentes cliente arman sus
// enlaces con useRuta() y hablan con Supabase con useSupabase().
const SesionTabContext = createContext<string | null>(null)

export const useSid = () => {
    const sid = useContext(SesionTabContext)
    if (!sid) throw new Error("useSid fuera de SesionTabProvider")
    return sid
}

// "/administrar/clientes" → "/s/<sid>/administrar/clientes"
export const useRuta = () => {
    const sid = useSid()
    return (path: string) => rutaTab(sid, path)
}

export const useSupabase = () => supabaseTab(useSid())

const CANAL = "playr-sesion-tab"

type Mensaje = { tipo: "quien", sid: string, de: string } | { tipo: "yo", sid: string, para: string }

const alLogin = () => window.location.replace("/")

// Una pestaña nueva no hereda la sesión de otra: si la URL trae un sid que esta
// pestaña no inició (enlace abierto en otra pestaña) o si otra pestaña ya lo usa
// (pestaña duplicada, que copia el sessionStorage), vuelve al login.
function useGuardia(sid: string) {
    useEffect(() => {
        let propio: string | null = null
        try {
            propio = sessionStorage.getItem(SID_STORAGE_KEY)
        } catch {
            // Sin sessionStorage no se puede saber de quién es la sesión.
        }
        if (propio !== sid) return alLogin()

        if (typeof BroadcastChannel === "undefined") return
        const canal = new BroadcastChannel(CANAL)
        const yo = crypto.randomUUID()
        let verificada = false

        canal.onmessage = ({ data }: MessageEvent<Mensaje>) => {
            if (data.sid !== sid) return
            if (data.tipo === "quien" && verificada) canal.postMessage({ tipo: "yo", sid, para: data.de } satisfies Mensaje)
            if (data.tipo === "yo" && data.para === yo && !verificada) {
                try {
                    sessionStorage.removeItem(SID_STORAGE_KEY)
                } catch {
                    // La redirección basta.
                }
                alLogin()
            }
        }
        canal.postMessage({ tipo: "quien", sid, de: yo } satisfies Mensaje)
        const espera = setTimeout(() => { verificada = true }, 300)

        return () => {
            clearTimeout(espera)
            canal.close()
        }
    }, [sid])
}

export default function SesionTabProvider({ sid, children }: Readonly<{ sid: string, children: React.ReactNode }>) {
    useGuardia(sid)
    return <SesionTabContext value={sid}>{children}</SesionTabContext>
}
