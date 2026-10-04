"use client"

import { useEffect } from "react"
import { pestanaLista, supabaseTab, tokenGuardado } from "@lib/supabase/client"

// Las rutas ya no llevan prefijo de pestaña (la sesión viaja en un header, ver
// @lib/sesion-tab): se conserva la firma para quien la usa.
export const useRuta = () => (path: string) => path

export const useSupabase = () => supabaseTab()

// Esta página se pudo renderizar con la cookie de paso de otra pestaña (abrió la URL
// justo cuando otra recargaba) o ser la copia de una pestaña duplicada: si esta pestaña
// no tiene sesión propia, vuelve al login.
export default function SesionTabProvider({ children }: Readonly<{ children: React.ReactNode }>) {
    useEffect(() => {
        pestanaLista().then(() => {
            if (!tokenGuardado()) window.location.replace("/")
        })
    }, [])
    return children
}
