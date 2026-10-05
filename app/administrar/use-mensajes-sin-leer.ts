"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { getSinLeerStaffAction } from "@action/manager-and-admin/mensajes/estado-action"
import { EVENTO_SIN_LEER } from "@lib/chat-bandeja"

const POLL_MS = 15_000
/** La bandeja puede avisar varias veces seguidas (abrir un chat, marcarlo leído…): se cuenta una sola vez. */
const ESPERA_MS = 300
/** Avisa a las demás pestañas de este navegador que el "sin leer" cambió. */
const CANAL = "playr-chat-sin-leer"

/**
 * Total de mensajes sin leer de todos los chats (insignia de Mensajes en el menú, solo staff). Consulta cada 15 s con la
 * pestaña visible, al volver a ella, al cambiar de ruta y cuando la bandeja avisa (`EVENTO_SIN_LEER`, también desde otra
 * pestaña). Con `enabled` en false (cliente) no consulta nada y devuelve 0.
 */
export function useMensajesSinLeer(enabled: boolean): number {
    const [total, setTotal] = useState(0)
    const pathname = usePathname()
    // Lo pone el efecto principal; el de la ruta lo usa para volver a contar sin rearmar el sondeo.
    const alNavegar = useRef<(() => void) | null>(null)

    // Va antes del efecto principal: al montar todavía no hay función y la primera cuenta la hace ese efecto.
    useEffect(() => {
        alNavegar.current?.()
    }, [pathname])

    useEffect(() => {
        if (!enabled) return
        let vivo = true
        let seq = 0
        let espera: ReturnType<typeof setTimeout> | undefined
        const canal = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CANAL)

        const contar = async () => {
            // Solo cuenta la última consulta: una respuesta vieja que llega tarde no pisa a la nueva.
            const n = ++seq
            const valor = await getSinLeerStaffAction().catch(() => null)
            if (vivo && n === seq && valor !== null) setTotal(valor)
        }
        const programar = (avisarPestanas: boolean) => {
            clearTimeout(espera)
            espera = setTimeout(() => {
                if (avisarPestanas) canal?.postMessage(null)
                // En segundo plano no se consulta: al volver a la pestaña se cuenta de inmediato.
                if (!document.hidden) contar()
            }, ESPERA_MS)
        }

        const tick = () => {
            if (!document.hidden) contar()
        }
        const onEvento = () => programar(true)
        const onCanal = () => programar(false)

        contar()
        alNavegar.current = () => programar(false)
        const intervalo = setInterval(tick, POLL_MS)
        document.addEventListener("visibilitychange", tick)
        window.addEventListener(EVENTO_SIN_LEER, onEvento)
        canal?.addEventListener("message", onCanal)
        return () => {
            vivo = false
            alNavegar.current = null
            clearInterval(intervalo)
            clearTimeout(espera)
            document.removeEventListener("visibilitychange", tick)
            window.removeEventListener(EVENTO_SIN_LEER, onEvento)
            canal?.close()
        }
    }, [enabled])

    return enabled ? total : 0
}
