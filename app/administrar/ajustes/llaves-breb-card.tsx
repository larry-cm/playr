"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, KeyRound, LoaderCircle, Pencil, Plus, Power, PowerOff, QrCode, Star, Trash2, Upload, X } from "lucide-react"
import Card from "@ui/card"
import Button from "@ui/button"
import Alert from "@ui/alert"
import Input from "@ui/input"
import { SectionHeader } from "@ui/page-header"
import { QR_LLAVE_ACCEPT, rutaQrLlave, validateLlaveBreb, validateNombreLlave, validateQrLlave } from "@lib/pedido"
import { supabaseTabListo } from "@lib/supabase/client"
import type { LlaveBreb } from "@lib/ajustes"
import {
    borrarLlaveBrebAction,
    crearLlaveBrebAction,
    editarLlaveBrebAction,
    guardarQrLlaveAction,
    marcarPredeterminadaAction,
    type LlaveResult,
} from "@action/admin/ajustes/llaves-breb-action"

const ERROR_RED = "No se pudo guardar la llave. Inténtalo de nuevo."

/** Nombre + llave, para agregar o editar. */
function FormLlave({
    inicial,
    textoBoton,
    onGuardar,
    onCancelar,
}: Readonly<{
    inicial?: { nombre: string; llave: string }
    textoBoton: string
    onGuardar: (nombre: string, llave: string) => Promise<LlaveResult>
    onCancelar?: () => void
}>) {
    const [nombre, setNombre] = useState(inicial?.nombre ?? "")
    const [llave, setLlave] = useState(inicial?.llave ?? "")
    const [errores, setErrores] = useState<{ nombre?: string; llave?: string; general?: string }>({})
    const [guardando, startGuardar] = useTransition()

    const guardar = (e: React.FormEvent) => {
        e.preventDefault()
        const err = { nombre: validateNombreLlave(nombre) ?? undefined, llave: validateLlaveBreb(llave) ?? undefined }
        setErrores(err)
        if (err.nombre || err.llave) return
        startGuardar(async () => {
            const res = await onGuardar(nombre, llave).catch((): LlaveResult => ({ ok: false, error: ERROR_RED }))
            if (!res.ok) {
                setErrores({ general: res.error })
                return
            }
            if (!inicial) {
                setNombre("")
                setLlave("")
            }
            setErrores({})
        })
    }

    return (
        <form onSubmit={guardar} noValidate className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <Input
                    name="nombre_llave"
                    label="Nombre"
                    required
                    autoComplete="off"
                    placeholder="Nequi, Bancolombia…"
                    value={nombre}
                    maxLength={40}
                    onChange={(e) => {
                        setNombre(e.target.value)
                        setErrores((p) => ({ ...p, nombre: undefined, general: undefined }))
                    }}
                    error={errores.nombre}
                />
                <Input
                    name="llave_breb"
                    label="Llave"
                    required
                    autoComplete="off"
                    placeholder="Celular, cédula, correo o @llave"
                    value={llave}
                    onChange={(e) => {
                        setLlave(e.target.value)
                        setErrores((p) => ({ ...p, llave: undefined, general: undefined }))
                    }}
                    error={errores.llave}
                />
            </div>
            {errores.general && <Alert variant="error" message={errores.general} />}
            <div className="flex justify-end gap-2">
                {onCancelar && (
                    <Button type="button" variant="secondary" size="sm" onClick={onCancelar} disabled={guardando}>
                        Cancelar
                    </Button>
                )}
                <Button type="submit" size="sm" isLoading={guardando} disabled={guardando} leftIcon={inicial ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}>
                    {textoBoton}
                </Button>
            </div>
        </form>
    )
}

/** Cuadro del QR: la imagen que genera la app del banco, o el botón para subirla. El cliente la ve al pagar. */
function QrLlave({ llave, onCambio }: Readonly<{ llave: LlaveBreb; onCambio: () => void }>) {
    const archivoRef = useRef<HTMLInputElement>(null)
    const [error, setError] = useState<string | null>(null)
    const [ocupado, startAccion] = useTransition()

    const subir = (archivo: File) => {
        const invalido = validateQrLlave(archivo)
        setError(invalido)
        if (invalido) return
        startAccion(async () => {
            try {
                const supabase = await supabaseTabListo()
                const path = rutaQrLlave(llave.id, archivo)
                const { error: errSubida } = await supabase.storage.from("llaves-qr").upload(path, archivo, { contentType: archivo.type, upsert: false })
                if (errSubida) {
                    setError("No se pudo subir el QR. Inténtalo de nuevo.")
                    return
                }
                const res = await guardarQrLlaveAction(llave.id, path)
                if (!res.ok) {
                    setError(res.error)
                    return
                }
                onCambio()
            } catch {
                setError("No se pudo subir el QR. Inténtalo de nuevo.")
            }
        })
    }

    const quitar = () =>
        startAccion(async () => {
            const res = await guardarQrLlaveAction(llave.id, null).catch((): LlaveResult => ({ ok: false, error: ERROR_RED }))
            if (res.ok) onCambio()
            else setError(res.error)
        })

    return (
        <div className="flex w-28 shrink-0 flex-col items-center gap-1.5">
            <input
                ref={archivoRef}
                type="file"
                accept={QR_LLAVE_ACCEPT}
                className="hidden"
                onChange={(e) => {
                    const archivo = e.target.files?.[0]
                    e.target.value = ""
                    if (archivo) subir(archivo)
                }}
            />
            <button
                type="button"
                onClick={() => archivoRef.current?.click()}
                disabled={ocupado}
                className={`group relative grid h-28 w-28 place-items-center overflow-hidden rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                    llave.qr_url ? "bg-white p-1.5" : "border border-dashed border-white/20 bg-white/3 text-secondary hover:border-accent/50 hover:text-white"
                }`}
                aria-label={llave.qr_url ? `Cambiar el QR de ${llave.nombre}` : `Subir el QR de ${llave.nombre}`}
                title={llave.qr_url ? "Cambiar QR" : "Sube el QR que genera tu app (Mis llaves → QR)"}
            >
                {llave.qr_url ? (
                    <>
                        {/* eslint-disable-next-line @next/next/no-img-element -- imagen pública de Supabase Storage */}
                        <img src={llave.qr_url} alt={`QR de ${llave.nombre}`} className="h-full w-full object-contain" />
                        <span className="absolute inset-0 grid place-items-center bg-black/60 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                            <span className="flex flex-col items-center gap-1">
                                <Upload className="h-4 w-4" aria-hidden="true" />
                                Cambiar
                            </span>
                        </span>
                    </>
                ) : (
                    <span className="flex flex-col items-center gap-1.5 px-2 text-center text-[11px] leading-tight">
                        <QrCode className="h-6 w-6" aria-hidden="true" />
                        Subir QR
                    </span>
                )}
                {ocupado && (
                    <span className="absolute inset-0 grid place-items-center bg-black/60">
                        <LoaderCircle className="h-5 w-5 animate-spin text-white" aria-hidden="true" />
                    </span>
                )}
            </button>
            {llave.qr_url && (
                <button type="button" onClick={quitar} disabled={ocupado} className="text-[11px] text-secondary hover:text-red-400">
                    Quitar QR
                </button>
            )}
            {error && <p className="text-center text-[11px] leading-tight text-red-400">{error}</p>}
        </div>
    )
}

const accion =
    "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-secondary transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"

function TarjetaLlave({ llave, onCambio }: Readonly<{ llave: LlaveBreb; onCambio: () => void }>) {
    const [modo, setModo] = useState<"ver" | "editar" | "borrar">("ver")
    const [error, setError] = useState<string | null>(null)
    const [ocupado, startAccion] = useTransition()

    const correr = (fn: () => Promise<LlaveResult>) =>
        startAccion(async () => {
            const res = await fn().catch((): LlaveResult => ({ ok: false, error: ERROR_RED }))
            setError(res.ok ? null : res.error)
            if (res.ok) {
                setModo("ver")
                onCambio()
            }
        })

    return (
        <li
            className={`flex flex-col gap-3 rounded-2xl border p-4 transition-colors ${
                llave.predeterminada ? "border-accent/40 bg-accent/5" : "border-white/8 bg-white/2"
            } ${llave.activa ? "" : "opacity-70"}`}
        >
            <div className="flex gap-4">
                <QrLlave llave={llave} onCambio={onCambio} />

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                    {modo === "editar" ? (
                        <FormLlave
                            inicial={llave}
                            textoBoton="Guardar"
                            onCancelar={() => setModo("ver")}
                            onGuardar={async (nombre, valor) => {
                                const res = await editarLlaveBrebAction(llave.id, nombre, valor, llave.activa)
                                if (res.ok) {
                                    setModo("ver")
                                    onCambio()
                                }
                                return res
                            }}
                        />
                    ) : (
                        <>
                            <div className="flex flex-wrap items-center gap-1.5">
                                <p className="mr-1 truncate text-base font-semibold text-white">{llave.nombre}</p>
                                {llave.predeterminada && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-white">
                                        <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                                        Predeterminada
                                    </span>
                                )}
                                <span
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                                        llave.activa ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/5 text-secondary"
                                    }`}
                                >
                                    <span className={`h-1.5 w-1.5 rounded-full ${llave.activa ? "bg-emerald-400" : "bg-white/40"}`} aria-hidden="true" />
                                    {llave.activa ? "Activa" : "Inactiva"}
                                </span>
                            </div>
                            <p className="break-all rounded-lg border border-white/8 bg-black/20 px-2.5 py-1.5 font-mono text-sm text-white/90">{llave.llave}</p>
                            {!llave.qr_url && <p className="text-[11px] text-secondary">Sin QR: el cliente solo podrá copiar la llave.</p>}

                            <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
                                {llave.activa && !llave.predeterminada && (
                                    <button type="button" className={accion} disabled={ocupado} onClick={() => correr(() => marcarPredeterminadaAction(llave.id))}>
                                        <Star className="h-3.5 w-3.5" aria-hidden="true" />
                                        Predeterminar
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className={accion}
                                    disabled={ocupado}
                                    onClick={() => correr(() => editarLlaveBrebAction(llave.id, llave.nombre, llave.llave, !llave.activa))}
                                    title={llave.activa && llave.predeterminada ? "Al desactivarla deja de ser la predeterminada" : undefined}
                                >
                                    {llave.activa ? <PowerOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Power className="h-3.5 w-3.5" aria-hidden="true" />}
                                    {llave.activa ? "Desactivar" : "Activar"}
                                </button>
                                <button type="button" className={accion} disabled={ocupado} onClick={() => setModo("editar")}>
                                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                    Editar
                                </button>
                                <button type="button" className={`${accion} hover:bg-red-500/10 hover:text-red-400`} disabled={ocupado} onClick={() => setModo("borrar")}>
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                    Eliminar
                                </button>
                                {ocupado && <LoaderCircle className="h-4 w-4 animate-spin text-secondary" aria-hidden="true" />}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {modo === "borrar" && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-200">
                    <span>¿Eliminar {llave.nombre}? Los pedidos ya pagados a esta llave no cambian.</span>
                    <span className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setModo("ver")} disabled={ocupado} leftIcon={<X className="h-3.5 w-3.5" />}>
                            No
                        </Button>
                        <Button variant="danger" size="sm" isLoading={ocupado} disabled={ocupado} onClick={() => correr(() => borrarLlaveBrebAction(llave.id))}>
                            Eliminar
                        </Button>
                    </span>
                </div>
            )}
            {error && <Alert variant="error" message={error} />}
        </li>
    )
}

/** Llaves Bre-B del negocio: en la Tienda el cliente elige a cuál transfiere antes de subir el comprobante. */
export default function LlavesBrebCard({ llaves }: Readonly<{ llaves: LlaveBreb[] }>) {
    const router = useRouter()
    const refrescar = () => router.refresh()
    const [agregando, setAgregando] = useState(llaves.length === 0)
    const activas = llaves.filter((l) => l.activa).length
    const predeterminada = llaves.find((l) => l.predeterminada)

    return (
        <Card>
            <SectionHeader
                icon={KeyRound}
                title="Llaves Bre-B"
                description="El cliente elige a cuál transfiere al pagar en la Tienda."
                action={
                    !agregando && (
                        <Button size="sm" onClick={() => setAgregando(true)} leftIcon={<Plus className="h-4 w-4" />}>
                            Agregar llave
                        </Button>
                    )
                }
            />

            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 border-t border-white/6 pt-4 text-xs text-secondary">
                <span>
                    <b className="text-white">{llaves.length}</b> {llaves.length === 1 ? "llave" : "llaves"}
                </span>
                <span>
                    <b className="text-white">{activas}</b> {activas === 1 ? "activa" : "activas"}
                </span>
                <span>
                    Predeterminada: <b className="text-white">{predeterminada?.nombre ?? "ninguna"}</b>
                </span>
                <span>
                    Con QR: <b className="text-white">{llaves.filter((l) => l.qr_url).length}</b>
                </span>
            </div>

            <div className="mt-4 flex flex-col gap-4">
                {activas === 0 && llaves.length > 0 && <Alert variant="warning" message="No hay llaves activas: los clientes no pueden pagar en la Tienda." />}
                {activas > 1 && !predeterminada && <Alert variant="info" message="Ninguna es la predeterminada: el cliente tendrá que elegir una al pagar." />}

                {agregando && (
                    <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
                        <p className="mb-3 text-sm font-medium text-white">Nueva llave</p>
                        <FormLlave
                            textoBoton="Agregar"
                            onCancelar={llaves.length > 0 ? () => setAgregando(false) : undefined}
                            onGuardar={async (nombre, llave) => {
                                const res = await crearLlaveBrebAction(nombre, llave)
                                if (res.ok) {
                                    setAgregando(false)
                                    refrescar()
                                }
                                return res
                            }}
                        />
                        <p className="mt-2 text-[11px] text-secondary">Después de agregarla puedes subir su QR.</p>
                    </div>
                )}

                {llaves.length > 0 && (
                    <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                        {llaves.map((l) => (
                            <TarjetaLlave key={`${l.id}-${l.nombre}-${l.llave}-${l.activa}-${l.predeterminada}-${l.qr_url}`} llave={l} onCambio={refrescar} />
                        ))}
                    </ul>
                )}
            </div>
        </Card>
    )
}
