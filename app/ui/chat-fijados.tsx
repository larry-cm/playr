"use client"

import { useState } from "react"
import { PinOff } from "lucide-react"
import type { AutorChat, MensajeFijado } from "@lib/chat-bandeja"

interface ChatFijadosProps {
    /** Fijados del chat (≤3), el más reciente primero. */
    fijados: MensajeFijado[]
    autorDe: (autor: AutorChat) => string
    /** Saltar al mensaje (si está cargado). */
    onIrA: (id: number) => void
    onDesfijar: (fijado: MensajeFijado) => void
}

/**
 * Franja de mensajes fijados arriba del chat, como Telegram: muestra uno; tocarla lleva a ese mensaje y pasa al
 * siguiente. Las rayitas de la izquierda dicen cuántos hay y cuál se ve. Alto fijo (h-12): no mueve el chat.
 */
export default function ChatFijados({ fijados, autorDe, onIrA, onDesfijar }: Readonly<ChatFijadosProps>) {
    const [indice, setIndice] = useState(0)
    if (fijados.length === 0) return null

    const i = indice % fijados.length
    const actual = fijados[i]
    const n = fijados.length

    return (
        <div className="flex h-12 shrink-0 items-center gap-1 rounded-xl border border-white/8 bg-white/[0.03] pr-1">
            <button
                type="button"
                onClick={() => {
                    onIrA(actual.id)
                    setIndice(i + 1)
                }}
                className="flex h-full min-w-0 flex-1 items-center gap-2.5 rounded-xl py-1.5 pl-2.5 text-left hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                aria-label={`Mensaje fijado ${i + 1} de ${n}, de ${autorDe(actual.autor)}: ${actual.texto}. Ir al mensaje`}
            >
                <span className="flex h-8 w-[3px] shrink-0 flex-col gap-[2px]" aria-hidden="true">
                    {fijados.map((f, j) => (
                        <span key={f.id} className={`min-h-0 flex-1 rounded-full transition-colors ${j === i ? "bg-accent" : "bg-white/20"}`} />
                    ))}
                </span>
                {/* contain: el texto largo se recorta y no ensancha el chat (su ancho mínimo no cuenta). */}
                <span className="min-w-0 flex-1 [contain:inline-size]">
                    <span className="block text-[11px] font-semibold leading-4 text-accent-hover">
                        Mensaje fijado{n > 1 ? ` ${i + 1} de ${n}` : ""}
                    </span>
                    <span className="block truncate text-xs leading-4 text-white/75">
                        <span className="text-secondary">{autorDe(actual.autor)}: </span>
                        {actual.texto}
                    </span>
                </span>
            </button>
            <button
                type="button"
                onClick={() => onDesfijar(actual)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-secondary hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                aria-label="Desfijar este mensaje"
                title="Desfijar"
            >
                <PinOff className="h-4 w-4" aria-hidden="true" />
            </button>
        </div>
    )
}
