"use client"

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { ArrowUp, ImagePlus, LoaderCircle, Mic, Pause, Trash2, X } from "lucide-react"
import Alert from "@ui/alert"
import { NotaVoz } from "@ui/chat-adjunto"
import { supabaseTabListo } from "@lib/supabase/client"
import { GRABACION_TIPOS, IMAGEN_ACCEPT, NOTA_VOZ_MAX_MS, mimeAdjunto, rutaAdjunto, validarAdjunto, type TipoAdjunto } from "@lib/chat-adjunto"
import type { AdjuntoSubido } from "@action/tienda/chat-asesor-action"

const MAX = 1000
/** El contador aparece cuando el mensaje se acerca al límite. */
const AVISO_LARGO = 800
/** La caja de texto crece con el mensaje hasta esta altura (px) y después hace scroll. */
const ALTO_MAX = 160
/** Barras de la onda en vivo mientras se graba. */
const BARRAS = 36
const SIN_SESION = "Tu sesión expiró. Vuelve a iniciar sesión."

type Borrador = { archivo: Blob; tipo: TipoAdjunto; url: string; duracion?: number }
/** Qué hacer al terminar de grabar: descartar, escucharla antes de enviar, o enviarla ya. */
type FinGrabacion = "cancelar" | "revisar" | "enviar"

interface Grabadora {
    rec: MediaRecorder
    fin: FinGrabacion
    timers: ReturnType<typeof setInterval>[]
    cerrarAudio: () => void
}

interface ChatCompositorProps {
    /** Carpeta del adjunto en el bucket 'chat': el cliente de la conversación. Sin valor = el usuario de la sesión. */
    clienteId?: string
    etiqueta: string
    placeholder: string
    /** Va sobre la caja de texto (p. ej. el pedido del que se habla). */
    encabezado?: ReactNode
    /** Guarda el mensaje; devuelve el error a mostrar o null si se envió. */
    onEnviar: (texto: string, adjunto: AdjuntoSubido | null) => Promise<string | null>
}

export const reloj = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000))
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

const botonIcono =
    "grid h-9 w-9 shrink-0 place-items-center rounded-full text-secondary transition-colors hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:pointer-events-none disabled:opacity-40"
const botonEnviar =
    "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-[#7c3aed] text-white shadow-[0_0_16px_rgba(139,92,246,0.35)] transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:pointer-events-none disabled:opacity-50"

/**
 * Caja para escribir en el chat con el asesor, al estilo de las apps de mensajería: texto que crece solo, imagen
 * (botón, pegar o arrastrar) y nota de voz grabada en el navegador (con onda en vivo; se puede escuchar antes de enviar).
 */
export default function ChatCompositor({ clienteId, etiqueta, placeholder, encabezado, onEnviar }: Readonly<ChatCompositorProps>) {
    const textoId = useId()
    const archivoRef = useRef<HTMLInputElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const [texto, setTexto] = useState("")
    const [borrador, setBorrador] = useState<Borrador | null>(null)
    const [grabando, setGrabando] = useState<{ desde: number; ahora: number; niveles: number[] } | null>(null)
    const [arrastrando, setArrastrando] = useState(false)
    const [enviando, setEnviando] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const grabadora = useRef<Grabadora | null>(null)
    // El envío directo desde la grabación termina en un callback del MediaRecorder: lee el texto actual por acá.
    const textoRef = useRef("")

    const estaGrabando = grabando !== null

    // La caja crece con el texto (y vuelve a su alto al enviar).
    useLayoutEffect(() => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = "auto"
        el.style.height = `${Math.min(el.scrollHeight, ALTO_MAX)}px`
    }, [texto, estaGrabando])

    // Libera la vista previa al cambiarla, y el micrófono si se cierra el chat grabando.
    useEffect(() => () => { if (borrador) URL.revokeObjectURL(borrador.url) }, [borrador])
    useEffect(
        () => () => {
            const g = grabadora.current
            if (g && g.rec.state !== "inactive") {
                g.fin = "cancelar"
                g.rec.stop()
            }
        },
        [],
    )

    const cambiarTexto = (valor: string) => {
        const recortado = valor.slice(0, MAX)
        textoRef.current = recortado
        setTexto(recortado)
    }

    const preparar = (archivo: Blob, tipo: TipoAdjunto, duracion?: number): Borrador | null => {
        const invalido = validarAdjunto(archivo, tipo)
        setError(invalido)
        return invalido ? null : { archivo, tipo, url: URL.createObjectURL(archivo), duracion }
    }

    const elegirImagen = (archivo: File | undefined) => {
        if (!archivo) return
        const b = preparar(archivo, "imagen")
        if (b) setBorrador(b)
        textareaRef.current?.focus()
    }

    const subir = async (b: Borrador): Promise<AdjuntoSubido | string> => {
        const supabase = await supabaseTabListo()
        let carpeta = clienteId
        if (!carpeta) {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return SIN_SESION
            carpeta = user.id
        }
        const mime = mimeAdjunto(b.archivo.type)
        const path = rutaAdjunto(carpeta, mime)
        const { error: errSubida } = await supabase.storage.from("chat").upload(path, b.archivo, { contentType: mime, upsert: false })
        if (errSubida) return "No se pudo subir el archivo. Revisa tu conexión e inténtalo de nuevo."
        return { path, tipo: b.tipo }
    }

    /** Sube el adjunto (si hay) y guarda el mensaje. Si falla, el adjunto queda como borrador para reintentar. */
    const enviarCon = async (valor: string, adjuntoLocal: Borrador | null) => {
        if ((!valor && !adjuntoLocal) || enviando) return
        setEnviando(true)
        try {
            const adjunto = adjuntoLocal ? await subir(adjuntoLocal) : null
            const errEnvio = typeof adjunto === "string" ? adjunto : await onEnviar(valor, adjunto)
            setError(errEnvio)
            if (errEnvio) {
                if (adjuntoLocal) setBorrador(adjuntoLocal)
                return
            }
            cambiarTexto("")
            setBorrador(null)
        } catch {
            setError("No se pudo enviar el mensaje. Inténtalo de nuevo.")
            if (adjuntoLocal) setBorrador(adjuntoLocal)
        } finally {
            setEnviando(false)
            textareaRef.current?.focus()
        }
    }

    const grabar = async () => {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
            setError("Tu navegador no permite grabar notas de voz.")
            return
        }
        // El medidor de volumen se crea acá, todavía dentro del clic: creado después de pedir el permiso, el navegador lo
        // deja suspendido y la onda no se mueve.
        let ctx: AudioContext | null = null
        try {
            ctx = new AudioContext()
        } catch {
            // Sin Web Audio la grabación funciona igual, sin onda.
        }
        let stream: MediaStream
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        } catch (e) {
            void ctx?.close().catch(() => {})
            const nombre = e instanceof DOMException ? e.name : ""
            setError(
                nombre === "NotFoundError"
                    ? "No encontramos un micrófono en este dispositivo."
                    : nombre === "NotAllowedError"
                      ? "El micrófono está bloqueado para este sitio. Actívalo en el candado de la barra de direcciones y vuelve a intentarlo."
                      : "No se pudo usar el micrófono. Revisa que ninguna otra app lo esté usando.",
            )
            return
        }

        // Onda en vivo: volumen del micrófono cada 80 ms, en decibeles (-55 dB = silencio, -10 dB = voz fuerte), con
        // subida rápida y bajada suave para que se lea como un medidor.
        let medir = () => 0
        let cerrarAudio = () => {}
        if (ctx) {
            const audio = ctx
            try {
                void audio.resume().catch(() => {})
                const analizador = audio.createAnalyser()
                analizador.fftSize = 1024
                audio.createMediaStreamSource(stream).connect(analizador)
                const muestras = new Float32Array(analizador.fftSize)
                let suave = 0
                medir = () => {
                    analizador.getFloatTimeDomainData(muestras)
                    let suma = 0
                    for (const v of muestras) suma += v * v
                    const db = 20 * Math.log10(Math.sqrt(suma / muestras.length) || 1e-8)
                    const nivel = Math.min(1, Math.max(0, (db + 55) / 45))
                    suave = nivel > suave ? nivel : suave * 0.6 + nivel * 0.4
                    return suave
                }
                cerrarAudio = () => void audio.close().catch(() => {})
            } catch {
                void audio.close().catch(() => {})
            }
        }

        const mimeType = GRABACION_TIPOS.find((t) => MediaRecorder.isTypeSupported(t))
        const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
        const partes: Blob[] = []
        const desde = Date.now()
        const g: Grabadora = { rec, fin: "revisar", timers: [], cerrarAudio }
        g.timers.push(
            setInterval(() => {
                const nivel = medir()
                setGrabando((s) => (s ? { ...s, ahora: Date.now(), niveles: [...s.niveles.slice(1 - BARRAS), nivel] } : s))
                if (Date.now() - desde >= NOTA_VOZ_MAX_MS && rec.state !== "inactive") rec.stop()
            }, 80),
        )
        rec.ondataavailable = (e) => {
            if (e.data.size) partes.push(e.data)
        }
        rec.onstop = () => {
            g.timers.forEach(clearInterval)
            g.cerrarAudio()
            stream.getTracks().forEach((t) => t.stop())
            grabadora.current = null
            setGrabando(null)
            if (g.fin === "cancelar") return
            const b = preparar(new Blob(partes, { type: rec.mimeType || mimeType || "audio/webm" }), "audio", (Date.now() - desde) / 1000)
            if (!b) return
            if (g.fin === "enviar") void enviarCon(textoRef.current.trim(), b)
            else setBorrador(b)
        }
        grabadora.current = g
        rec.start()
        setError(null)
        setBorrador(null)
        setGrabando({ desde, ahora: desde, niveles: Array(BARRAS).fill(0) })
    }

    const terminarGrabacion = (fin: FinGrabacion) => {
        const g = grabadora.current
        if (!g) return
        g.fin = fin
        if (g.rec.state !== "inactive") g.rec.stop()
    }

    const enviar = (e: React.FormEvent) => {
        e.preventDefault()
        if (grabando) return
        void enviarCon(texto.trim(), borrador)
    }

    const hayAlgo = !!texto.trim() || !!borrador

    return (
        <form
            onSubmit={enviar}
            className="flex flex-col gap-2"
            onDragOver={(e) => {
                if (!e.dataTransfer.types.includes("Files")) return
                e.preventDefault()
                setArrastrando(true)
            }}
            onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArrastrando(false)
            }}
            onDrop={(e) => {
                e.preventDefault()
                setArrastrando(false)
                elegirImagen(e.dataTransfer.files[0])
            }}
        >
            {error && <Alert variant="error" message={error} />}
            {encabezado}

            <div
                className={`relative flex flex-col rounded-3xl border bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors focus-within:border-accent/50 focus-within:bg-white/[0.06] ${
                    arrastrando ? "border-accent/70 bg-accent/10" : grabando ? "border-red-500/40" : "border-white/10"
                }`}
            >
                {arrastrando && (
                    <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-3xl text-sm font-medium text-white">
                        Suelta la imagen para adjuntarla
                    </div>
                )}

                {borrador && !grabando && (
                    <div className="flex items-center gap-3 border-b border-white/8 p-2 pl-3">
                        {borrador.tipo === "imagen" ? (
                            <div className="relative">
                                {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:) */}
                                <img src={borrador.url} alt="Imagen a enviar" className="h-20 w-20 rounded-2xl border border-white/10 object-cover" />
                                <button
                                    type="button"
                                    onClick={() => setBorrador(null)}
                                    disabled={enviando}
                                    className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full border border-white/15 bg-neutral-900 text-white shadow hover:bg-red-600"
                                    aria-label="Quitar la imagen"
                                >
                                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                            </div>
                        ) : (
                            <>
                                <NotaVoz url={borrador.url} duracion={borrador.duracion} className="min-w-0 flex-1" />
                                <button type="button" onClick={() => setBorrador(null)} disabled={enviando} className={botonIcono} aria-label="Descartar la nota de voz">
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </button>
                            </>
                        )}
                        {borrador.tipo === "imagen" && <span className="text-xs text-secondary">Agrega un comentario si quieres y envíala.</span>}
                    </div>
                )}

                {grabando ? (
                    <div className="flex items-center gap-2 p-1.5" role="status" aria-label="Grabando nota de voz">
                        <button type="button" onClick={() => terminarGrabacion("cancelar")} className={botonIcono} aria-label="Descartar la grabación" title="Descartar">
                            <Trash2 className="h-[18px] w-[18px]" aria-hidden="true" />
                        </button>
                        <span className="flex items-center gap-2 pl-1 text-sm font-medium tabular-nums text-white">
                            <span className="relative flex h-2.5 w-2.5">
                                <span
                                    className="absolute inset-0 rounded-full bg-red-500/50 transition-transform duration-75"
                                    style={{ transform: `scale(${1 + (grabando.niveles.at(-1) ?? 0) * 1.6})` }}
                                />
                                <span className="relative h-2.5 w-2.5 rounded-full bg-red-500" />
                            </span>
                            {reloj(grabando.ahora - grabando.desde)}
                        </span>
                        <div className="flex h-8 min-w-0 flex-1 items-center justify-end gap-[3px] overflow-hidden px-1" aria-hidden="true">
                            {grabando.niveles.map((n, i) => (
                                <span
                                    key={i}
                                    className={`w-[3px] shrink-0 rounded-full transition-[height] duration-75 ${n > 0.85 ? "bg-red-400" : n > 0.08 ? "bg-white" : "bg-white/30"}`}
                                    style={{ height: `${Math.round(4 + n * 26)}px` }}
                                />
                            ))}
                        </div>
                        <button type="button" onClick={() => terminarGrabacion("revisar")} className={botonIcono} aria-label="Pausar y escuchar antes de enviar" title="Escuchar antes de enviar">
                            <Pause className="h-[18px] w-[18px]" aria-hidden="true" />
                        </button>
                        <button type="button" onClick={() => terminarGrabacion("enviar")} className={botonEnviar} aria-label="Enviar la nota de voz" title="Enviar">
                            <ArrowUp className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-end gap-1 p-1.5">
                        <input
                            ref={archivoRef}
                            type="file"
                            accept={IMAGEN_ACCEPT}
                            className="hidden"
                            onChange={(e) => {
                                const archivo = e.target.files?.[0]
                                e.target.value = ""
                                elegirImagen(archivo)
                            }}
                        />
                        <button type="button" onClick={() => archivoRef.current?.click()} disabled={enviando} className={botonIcono} aria-label="Adjuntar una imagen" title="Adjuntar una imagen">
                            <ImagePlus className="h-5 w-5" aria-hidden="true" />
                        </button>
                        <label htmlFor={textoId} className="sr-only">{etiqueta}</label>
                        <textarea
                            id={textoId}
                            ref={textareaRef}
                            value={texto}
                            onChange={(e) => cambiarTexto(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                                    e.preventDefault()
                                    e.currentTarget.form?.requestSubmit()
                                }
                            }}
                            onPaste={(e) => {
                                const imagen = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"))
                                if (!imagen) return
                                e.preventDefault()
                                elegirImagen(imagen)
                            }}
                            rows={1}
                            placeholder={borrador ? "Agrega un comentario…" : placeholder}
                            className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 text-white placeholder:text-secondary focus:outline-none"
                        />
                        {hayAlgo || enviando ? (
                            <button type="submit" disabled={enviando || !hayAlgo} className={botonEnviar} aria-label="Enviar" title="Enviar (Enter)">
                                {enviando ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" /> : <ArrowUp className="h-5 w-5" aria-hidden="true" />}
                            </button>
                        ) : (
                            <button type="button" onClick={() => void grabar()} className={botonIcono} aria-label="Grabar una nota de voz" title="Grabar una nota de voz">
                                <Mic className="h-5 w-5" aria-hidden="true" />
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between px-3 text-[11px] text-secondary">
                <span className="hidden sm:inline">
                    {grabando ? "Máximo 3 minutos por nota de voz" : "Enter para enviar · Shift + Enter para otra línea · Puedes pegar o arrastrar una imagen"}
                </span>
                {texto.length >= AVISO_LARGO && <span className={`ml-auto tabular-nums ${texto.length >= MAX ? "text-red-400" : ""}`}>{texto.length}/{MAX}</span>}
            </div>
        </form>
    )
}
