"use client"

import { useEffect, useRef, useState } from "react"
import { Pause, Play } from "lucide-react"
import type { TipoAdjunto } from "@lib/chat-adjunto"

const reloj = (s: number) => {
    const t = Number.isFinite(s) ? Math.max(0, Math.floor(s)) : 0
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`
}

/** Barras de la forma de onda: caben en el ancho fijo del reproductor (w-64), así nunca cambia de tamaño. */
const BARRAS = 40

interface Onda {
    barras: number[]
    duracion: number
}

// Una forma de onda por audio (sin el token de la URL firmada, que cambia al refrescar): el chat se relee cada pocos
// segundos y no debe volver a descargar ni decodificar.
const ondas = new Map<string, Promise<Onda | null>>()

/** Lee el audio y lo resume en BARRAS alturas 0..1 (pico de cada tramo, normalizado al más alto). null = no se pudo leer. */
function ondaDe(url: string): Promise<Onda | null> {
    const clave = url.split("?")[0]
    let onda = ondas.get(clave)
    if (!onda) {
        onda = (async () => {
            const datos = await (await fetch(url)).arrayBuffer()
            // OfflineAudioContext decodifica sin pedir permiso de reproducción (un AudioContext normal nace suspendido).
            const audio = await new OfflineAudioContext(1, 1, 44_100).decodeAudioData(datos)
            const canales = Array.from({ length: audio.numberOfChannels }, (_, c) => audio.getChannelData(c))
            const tramo = Math.max(1, Math.floor(audio.length / BARRAS))
            const picos = Array.from({ length: BARRAS }, (_, b) => {
                let pico = 0
                for (let i = b * tramo; i < Math.min((b + 1) * tramo, audio.length); i++) {
                    for (const canal of canales) pico = Math.max(pico, Math.abs(canal[i]))
                }
                return pico
            })
            const max = Math.max(...picos) || 1
            // raíz: la voz baja también se ve; mínimo 8% para que el silencio sea una raya y no un hueco
            return { barras: picos.map((p) => Math.max(0.08, Math.sqrt(p / max))), duracion: audio.duration }
        })().catch(() => null)
        ondas.set(clave, onda)
    }
    return onda
}

/** Mientras se lee el audio (o si no se pudo): barras bajas y parejas, mismo tamaño que la forma real. */
const PLANA = Array.from({ length: BARRAS }, () => 0.15)

function Barras({ alturas, className }: Readonly<{ alturas: number[]; className: string }>) {
    return (
        <div className="flex h-full w-full items-center gap-[2px]" aria-hidden="true">
            {alturas.map((h, i) => (
                <span key={i} className={`min-w-0 flex-1 rounded-full transition-[height] duration-300 motion-reduce:transition-none ${className}`} style={{ height: `${h * 100}%` }} />
            ))}
        </div>
    )
}

/**
 * Reproductor de una nota de voz: play/pausa, barra para adelantar y tiempo. `duracion` (segundos) se usa mientras el
 * navegador no la conoce: los WebM que graba Chrome no la traen y hasta terminar de leerlos dicen "Infinity".
 */
export function NotaVoz({ url, duracion, className = "" }: Readonly<{ url: string; duracion?: number; className?: string }>) {
    const audioRef = useRef<HTMLAudioElement>(null)
    const [sonando, setSonando] = useState(false)
    const [actual, setActual] = useState(0)
    const [total, setTotal] = useState(duracion ?? 0)
    // Truco para los WebM sin duración: saltar al final obliga al navegador a calcularla.
    const calculando = useRef(false)
    const [barras, setBarras] = useState<number[] | null>(null)

    useEffect(() => {
        let vigente = true
        void ondaDe(url).then((onda) => {
            if (!vigente || !onda) return
            setBarras(onda.barras)
            // el audio decodificado sí trae la duración exacta (el WebM de Chrome no)
            setTotal((t) => (t > 0 && Number.isFinite(t) ? t : onda.duracion))
        })
        return () => {
            vigente = false
        }
    }, [url])

    // timeupdate llega ~4 veces por segundo: mientras suena se lee la posición en cada cuadro para que la onda se llene suave
    useEffect(() => {
        if (!sonando) return
        let cuadro = 0
        const paso = () => {
            const a = audioRef.current
            if (a && !calculando.current) setActual(a.currentTime)
            cuadro = requestAnimationFrame(paso)
        }
        cuadro = requestAnimationFrame(paso)
        return () => cancelAnimationFrame(cuadro)
    }, [sonando])

    const alternar = () => {
        const a = audioRef.current
        if (!a) return
        if (a.paused) void a.play().catch(() => setSonando(false))
        else a.pause()
    }

    const progreso = total > 0 ? Math.min(100, (actual / total) * 100) : 0

    return (
        <div className={`flex w-64 max-w-full items-center gap-3 whitespace-normal ${className}`}>
            <audio
                ref={audioRef}
                src={url}
                preload="metadata"
                onLoadedMetadata={(e) => {
                    const a = e.currentTarget
                    if (Number.isFinite(a.duration)) setTotal(a.duration)
                    else {
                        calculando.current = true
                        a.currentTime = 1e7
                    }
                }}
                onDurationChange={(e) => {
                    if (Number.isFinite(e.currentTarget.duration)) setTotal(e.currentTarget.duration)
                }}
                onTimeUpdate={(e) => {
                    const a = e.currentTarget
                    if (calculando.current) {
                        calculando.current = false
                        if (Number.isFinite(a.duration)) setTotal(a.duration)
                        a.currentTime = 0
                        return
                    }
                    setActual(a.currentTime)
                }}
                onPlay={() => setSonando(true)}
                onPause={() => setSonando(false)}
                onEnded={(e) => {
                    setSonando(false)
                    setActual(0)
                    e.currentTarget.currentTime = 0
                }}
            />
            <button
                type="button"
                onClick={alternar}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-neutral-900 shadow transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                aria-label={sonando ? "Pausar la nota de voz" : "Reproducir la nota de voz"}
            >
                {sonando ? <Pause className="h-4 w-4" fill="currentColor" aria-hidden="true" /> : <Play className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden="true" />}
            </button>
            <div className="relative flex h-9 min-w-0 flex-1 items-center">
                {/* Forma de onda del audio: abajo apagada, encima la misma en blanco recortada hasta donde va la reproducción. */}
                <div className="relative h-7 w-full">
                    <Barras alturas={barras ?? PLANA} className="bg-white/30" />
                    <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - progreso}% 0 0)` }}>
                        <Barras alturas={barras ?? PLANA} className="bg-white" />
                    </div>
                </div>
                <span
                    className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
                    style={{ left: `${progreso}%` }}
                    aria-hidden="true"
                />
                {/* Control real (teclado y lectores de pantalla), invisible encima de la barra dibujada. */}
                <input
                    type="range"
                    min={0}
                    max={total || 1}
                    step={0.1}
                    value={Math.min(actual, total || 1)}
                    onChange={(e) => {
                        const a = audioRef.current
                        if (!a || !total) return
                        a.currentTime = Number(e.target.value)
                        setActual(a.currentTime)
                    }}
                    aria-label="Posición de la nota de voz"
                    className="absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0"
                />
            </div>
            <span className="w-9 shrink-0 text-right text-[11px] tabular-nums leading-none text-white/70">{sonando || actual > 0 ? reloj(actual) : reloj(total)}</span>
        </div>
    )
}

/** Imagen o nota de voz dentro de una burbuja del chat. url null = no se pudo abrir (enlace sin firmar). */
export default function ChatAdjunto({ tipo, url }: Readonly<{ tipo: TipoAdjunto; url: string | null }>) {
    if (!url) return <span className="block text-xs italic text-white/60">{tipo === "imagen" ? "Imagen no disponible" : "Nota de voz no disponible"}</span>
    if (tipo === "audio") return <NotaVoz url={url} />
    return (
        <a href={url} target="_blank" rel="noopener noreferrer" className="-mx-1 -mt-0.5 block overflow-hidden rounded-xl" aria-label="Abrir la imagen">
            {/* Caja fija (miniatura cuadrada): la burbuja ya tiene su tamaño antes de que la imagen cargue, así el chat no salta. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada y temporal de Supabase Storage */}
            <img src={url} alt="Imagen enviada en el chat" loading="lazy" className="h-56 w-56 max-w-full bg-white/5 object-cover transition-opacity hover:opacity-90" />
        </a>
    )
}
