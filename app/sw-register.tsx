"use client"

import { useEffect } from "react"

// Registra el service worker (public/sw.js), que recibe los comprobantes compartidos desde otra app con Playr instalado.
// updateViaCache "none": cada visita revisa si hay una versión nueva del worker sin pasar por la caché HTTP.
export default function SwRegister() {
    useEffect(() => {
        if (!("serviceWorker" in navigator)) return
        navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((e) => {
            console.error("No se pudo registrar el service worker:", e)
        })
    }, [])
    return null
}
