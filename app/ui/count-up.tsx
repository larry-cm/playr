"use client"

import { useEffect, useRef, useState } from "react"

// Duración fija compartida: todos los contadores llegan a su meta al mismo tiempo.
const COUNT_DURATION_MS = 900

type Subscriber = (now: number) => void

// Un único driver rAF compartido por todos los CountUp montados: mismo timestamp
// por frame para todos → llegan a la meta exactamente en el mismo frame.
const subscribers = new Set<Subscriber>()
let rafId: number | null = null

function loop(now: number) {
    subscribers.forEach((fn) => fn(now))
    rafId = subscribers.size > 0 ? requestAnimationFrame(loop) : null
}

function subscribe(fn: Subscriber) {
    subscribers.add(fn)
    if (rafId === null) rafId = requestAnimationFrame(loop)
    return () => {
        subscribers.delete(fn)
        if (subscribers.size === 0 && rafId !== null) {
            cancelAnimationFrame(rafId)
            rafId = null
        }
    }
}

function easeOutExpo(p: number) {
    return p === 1 ? 1 : 1 - Math.pow(2, -10 * p)
}

// Sin valor todavía (fallback de Suspense) se muestra un guion neutro, no un "0" que parezca dato real.
const PLACEHOLDER = "—"

export default function CountUp({ value }: { value?: number }) {
    const ref = useRef<HTMLSpanElement>(null)
    // Texto inicial fijo por instancia: después lo escribe solo el efecto (React no vuelve a tocar el nodo).
    const [initialText] = useState(value === undefined ? PLACEHOLDER : "0")

    useEffect(() => {
        const node = ref.current
        if (!node) return
        if (value === undefined) {
            node.textContent = PLACEHOLDER
            return
        }
        if (value === 0) {
            node.textContent = "0"
            return
        }
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            node.textContent = String(value)
            return
        }
        const start = performance.now()
        return subscribe((now) => {
            const progress = Math.min((now - start) / COUNT_DURATION_MS, 1)
            node.textContent = String(
                progress < 1 ? Math.round(value * easeOutExpo(progress)) : value
            )
        })
    }, [value])

    return (
        <span
            ref={ref}
            aria-live="off"
            className="tabular-nums inline-block min-w-[2ch]"
        >
            {initialText}
        </span>
    )
}
