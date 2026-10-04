"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * Vuelve a pedir los datos del servidor de la página (router.refresh: no recarga ni pierde el estado de la pantalla)
 * cada `cadaMs` mientras la pestaña está visible, y al volver a ella. Así un pedido aprobado o rechazado desde Telegram
 * se ve sin recargar.
 */
export default function AutoRefresh({ cadaMs, activo = true }: Readonly<{ cadaMs: number; activo?: boolean }>) {
    const router = useRouter()

    useEffect(() => {
        if (!activo) return
        const refrescar = () => {
            if (document.visibilityState === "visible") router.refresh()
        }
        const timer = setInterval(refrescar, cadaMs)
        document.addEventListener("visibilitychange", refrescar)
        return () => {
            clearInterval(timer)
            document.removeEventListener("visibilitychange", refrescar)
        }
    }, [router, cadaMs, activo])

    return null
}
