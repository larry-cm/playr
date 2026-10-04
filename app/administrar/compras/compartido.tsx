"use client"

import { useEffect, useRef, useState } from "react"
import { MessageCircle, RefreshCw, Trash2 } from "lucide-react"
import Alert from "@ui/alert"
import Button from "@ui/button"
import Card from "@ui/card"
import { subirAdjunto, tipoArchivo } from "@ui/chat-compositor"
import { tipoComprobante } from "@lib/pedido"
import { validarAdjunto } from "@lib/chat-adjunto"
import type { MiPedido } from "@action/tienda/get-mis-pedidos-action"
import { enviarMensajeAction } from "@action/tienda/chat-asesor-action"
import { enviarComprobante } from "@/app/administrar/compras/enviar-comprobante"

// Archivo compartido desde otra app (Nequi, la app del banco) con Playr instalado: el service worker (public/sw.js) lo
// dejó en IndexedDB y abrió Mis compras con ?compartido=1. Si hay un pedido esperando su comprobante, se le entrega; si
// no, el cliente decide si se lo manda al asesor por el chat o lo descarta. Se lee una sola vez y se borra al leerlo.

const DB = "playr-compartir"
const STORE = "archivos"
const CLAVE = "ultimo"
/** Un archivo guardado hace más de esto no es el que se acaba de compartir (p. ej. quedó de un intento anterior). */
const VIGENCIA_MS = 30 * 60 * 1000

interface Guardado {
    archivo: Blob
    nombre?: string
    tipo?: string
    fecha?: number
}

/** Saca el último archivo compartido de IndexedDB (y lo borra); null si no hay uno reciente. */
function tomarCompartido(): Promise<File | null> {
    return new Promise((resolve) => {
        let req: IDBOpenDBRequest
        try {
            req = indexedDB.open(DB, 1)
        } catch {
            resolve(null)
            return
        }
        req.onupgradeneeded = () => req.result.createObjectStore(STORE)
        req.onerror = () => resolve(null)
        req.onsuccess = () => {
            const db = req.result
            let valor: Guardado | undefined
            try {
                const tx = db.transaction(STORE, "readwrite")
                const store = tx.objectStore(STORE)
                const get = store.get(CLAVE)
                get.onsuccess = () => { valor = get.result as Guardado | undefined }
                store.delete(CLAVE)
                tx.oncomplete = () => {
                    db.close()
                    if (!(valor?.archivo instanceof Blob) || Date.now() - (valor.fecha ?? 0) > VIGENCIA_MS) return resolve(null)
                    const nombre = valor.nombre || "comprobante"
                    // Android a veces lo entrega sin tipo: se deduce de la extensión (igual que al subir el comprobante).
                    const tipo = tipoComprobante(new File([valor.archivo], nombre, { type: valor.tipo ?? valor.archivo.type }))
                    resolve(new File([valor.archivo], nombre, { type: tipo || valor.tipo || valor.archivo.type }))
                }
                tx.onerror = tx.onabort = () => {
                    db.close()
                    resolve(null)
                }
            } catch {
                db.close()
                resolve(null)
            }
        }
    })
}

type Estado =
    | { paso: "leyendo" }
    | { paso: "enviando"; pedidoId: number }
    | { paso: "enviado"; pedidoId: number }
    | { paso: "error"; pedidoId: number; archivo: File; mensaje: string }
    | { paso: "sin-pedido"; archivo: File; enviando?: boolean; error?: string }
    | { paso: "aviso"; mensaje: string }
    | { paso: "cerrado" }

interface CompartidoProps {
    pedidos: MiPedido[]
    /** Abre el chat con el asesor (sobre un pedido o en general). */
    onAbrirChat: (pedidoId: number | null) => void
    /** El comprobante quedó en el pedido (pasa a "Por verificar"). */
    onEnviado: (pedidoId: number) => void
}

export default function Compartido({ pedidos, onAbrirChat, onEnviado }: Readonly<CompartidoProps>) {
    const [estado, setEstado] = useState<Estado>({ paso: "leyendo" })
    const tomado = useRef(false)
    const cerrar = () => setEstado({ paso: "cerrado" })

    const entregar = async (pedidoId: number, archivo: File) => {
        setEstado({ paso: "enviando", pedidoId })
        const error = await enviarComprobante(pedidoId, archivo)
        if (error) {
            setEstado({ paso: "error", pedidoId, archivo, mensaje: error })
            return
        }
        setEstado({ paso: "enviado", pedidoId })
        onEnviado(pedidoId)
        onAbrirChat(pedidoId)
    }
    /** Sin pedido que lo espere: va al chat como un adjunto normal (imagen o PDF). */
    const enviarAlAsesor = async (archivo: File) => {
        const tipo = tipoArchivo(archivo)
        const invalido = validarAdjunto(archivo, tipo)
        if (invalido) {
            setEstado({ paso: "sin-pedido", archivo, error: invalido })
            return
        }
        setEstado({ paso: "sin-pedido", archivo, enviando: true })
        try {
            const adjunto = await subirAdjunto(archivo, tipo)
            const res = typeof adjunto === "string" ? { ok: false as const, error: adjunto } : await enviarMensajeAction("", null, adjunto)
            if (!res.ok) {
                setEstado({ paso: "sin-pedido", archivo, error: res.error })
                return
            }
            cerrar()
            onAbrirChat(null)
        } catch {
            setEstado({ paso: "sin-pedido", archivo, error: "No se pudo enviar el archivo. Inténtalo de nuevo." })
        }
    }

    const entregarRef = useRef(entregar)
    useEffect(() => { entregarRef.current = entregar })

    useEffect(() => {
        // Una sola vez (el modo estricto corre dos veces el efecto y el archivo se borra al leerlo).
        if (tomado.current) return
        tomado.current = true
        // Que recargar la página no lo vuelva a procesar.
        const url = new URL(window.location.href)
        url.searchParams.delete("compartido")
        window.history.replaceState(null, "", `${url.pathname}${url.search}`)

        void (async () => {
            const archivo = await tomarCompartido()
            if (!archivo) {
                setEstado({ paso: "aviso", mensaje: "No pudimos recibir el archivo que compartiste. Adjúntalo desde el chat con el asesor." })
                return
            }
            const esperando = pedidos.filter((p) => p.estado === "esperando_comprobante")
            if (esperando.length === 0) setEstado({ paso: "sin-pedido", archivo })
            else if (esperando.length > 1) setEstado({ paso: "aviso", mensaje: "Tienes varios pedidos esperando comprobante. Envíalo desde el chat con el asesor." })
            else await entregarRef.current(esperando[0].id, archivo)
        })()
    }, [pedidos])

    switch (estado.paso) {
        case "leyendo":
            return <Alert message="Recibiendo el archivo que compartiste…" />
        case "enviando":
            return <Alert message={`Enviando el comprobante del pedido #${estado.pedidoId}…`} />
        case "enviado":
            return <Alert variant="success" message={`Comprobante enviado, pedido #${estado.pedidoId} por verificar.`} onDismiss={cerrar} />
        case "error":
            return (
                <Card padding="p-4" className="flex flex-col gap-3">
                    <Alert variant="error" message={estado.mensaje} />
                    <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => void entregar(estado.pedidoId, estado.archivo)} leftIcon={<RefreshCw className="h-4 w-4" />}>Reintentar</Button>
                        <Button size="sm" variant="secondary" onClick={() => { cerrar(); onAbrirChat(estado.pedidoId) }} leftIcon={<MessageCircle className="h-4 w-4" />}>Abrir el chat</Button>
                    </div>
                </Card>
            )
        case "sin-pedido":
            return (
                <Card padding="p-4" className="flex flex-col gap-3">
                    <Alert variant="warning" message="No tienes pedidos esperando comprobante. ¿Quieres enviarle el archivo que compartiste al asesor por el chat?" />
                    {estado.error && <Alert variant="error" message={estado.error} />}
                    <div className="flex flex-wrap gap-2">
                        <Button size="sm" isLoading={estado.enviando} disabled={estado.enviando} onClick={() => void enviarAlAsesor(estado.archivo)} leftIcon={<MessageCircle className="h-4 w-4" />}>
                            Enviar al asesor
                        </Button>
                        <Button size="sm" variant="secondary" disabled={estado.enviando} onClick={cerrar} leftIcon={<Trash2 className="h-4 w-4" />}>Descartar</Button>
                    </div>
                </Card>
            )
        case "aviso":
            return (
                <Card padding="p-4" className="flex flex-col gap-3">
                    <Alert variant="warning" message={estado.mensaje} />
                    <Button size="sm" variant="secondary" className="self-start" onClick={() => { cerrar(); onAbrirChat(null) }} leftIcon={<MessageCircle className="h-4 w-4" />}>Abrir el chat</Button>
                </Card>
            )
        case "cerrado":
            return null
    }
}
