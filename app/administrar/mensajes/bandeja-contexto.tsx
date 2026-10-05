"use client"

// Estado compartido de la bandeja (lista, menú de cada chat, panel de detalles y gestores): los chats con los cambios
// optimistas aplicados, etiquetas, carpetas y las acciones sobre un chat.
import { createContext, useCallback, useContext, useMemo, useOptimistic, useState, useTransition, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { CHATS_FIJADOS_MAX, EVENTO_SIN_LEER } from "@lib/chat-bandeja"
import type { Carpeta, Conversacion, Etiqueta } from "@action/manager-and-admin/mensajes/mensajes-action"
import { archivarChatAction, eliminarChatAction, fijarChatAction, marcarNoLeidoAction } from "@action/manager-and-admin/mensajes/estado-action"
import { asignarEtiquetasAction } from "@action/manager-and-admin/mensajes/etiquetas-action"
import { carpetasDeClienteAction } from "@action/manager-and-admin/mensajes/carpetas-action"
import { getConversacionAction } from "@action/manager-and-admin/mensajes/mensajes-action"

type Respuesta = { ok: true } | { ok: false; error: string }
/** Dónde se muestra el error de una acción: arriba de la lista o en el panel de detalles. */
export type OrigenAccion = "lista" | "panel"
type Parche = { id: string; cambio?: Partial<Conversacion>; quitar?: boolean }

export interface AccionesChat {
    fijar: (c: Conversacion, fijar: boolean, origen?: OrigenAccion) => void
    archivar: (c: Conversacion, archivar: boolean, origen?: OrigenAccion) => void
    marcarNoLeido: (c: Conversacion, origen?: OrigenAccion) => void
    marcarLeido: (c: Conversacion, origen?: OrigenAccion) => void
    eliminar: (c: Conversacion, origen?: OrigenAccion) => void
    /** Devuelven el error (o null) además de mostrarlo: la lista de casillas se queda abierta si falló. */
    asignarEtiquetas: (c: Conversacion, ids: number[], origen?: OrigenAccion) => Promise<string | null>
    asignarCarpetas: (c: Conversacion, ids: number[], origen?: OrigenAccion) => Promise<string | null>
}

/** Por qué no se puede fijar (o null si se puede). */
export type MotivoNoFijar = string | null

interface BandejaCtx {
    /** Todos los chats (también archivados) con los cambios en curso ya aplicados. */
    conversaciones: Conversacion[]
    etiquetas: Etiqueta[]
    carpetas: Carpeta[]
    acciones: AccionesChat
    motivoNoFijar: (c: Conversacion) => MotivoNoFijar
    error: { texto: string; origen: OrigenAccion } | null
    cerrarError: () => void
    abrirGestor: (g: "etiquetas" | "carpetas") => void
}

const Contexto = createContext<BandejaCtx | null>(null)

export function useBandeja(): BandejaCtx {
    const ctx = useContext(Contexto)
    if (!ctx) throw new Error("useBandeja fuera de BandejaProvider")
    return ctx
}

const avisarSinLeer = () => window.dispatchEvent(new Event(EVENTO_SIN_LEER))

interface ProviderProps {
    conversaciones: Conversacion[]
    etiquetas: Etiqueta[]
    carpetas: Carpeta[]
    abrirGestor: (g: "etiquetas" | "carpetas") => void
    /** Se llama antes de eliminar o marcar no leído el chat abierto: se cierra (abierto, se volvería a leer solo). */
    alSalirDelChat: (clienteId: string) => void
    children: ReactNode
}

export function BandejaProvider({ conversaciones, etiquetas, carpetas, abrirGestor, alSalirDelChat, children }: Readonly<ProviderProps>) {
    const router = useRouter()
    const [, startTransition] = useTransition()
    const [error, setError] = useState<BandejaCtx["error"]>(null)
    // El cambio se ve al instante; si la acción falla, vuelve solo a lo que dice el servidor.
    const [vista, aplicar] = useOptimistic(conversaciones, (cs: Conversacion[], p: Parche) =>
        p.quitar ? cs.filter((c) => c.cliente_id !== p.id) : cs.map((c) => (c.cliente_id === p.id ? { ...c, ...p.cambio } : c)),
    )

    const ejecutar = useCallback(
        (parche: Parche, llamada: () => Promise<Respuesta>, origen: OrigenAccion, sinLeer = false) =>
            new Promise<string | null>((resolver) => {
                setError(null)
                startTransition(async () => {
                    aplicar(parche)
                    const r = await llamada().catch((): Respuesta => ({ ok: false, error: "No se pudo guardar el cambio. Inténtalo de nuevo." }))
                    if (!r.ok) {
                        setError({ texto: r.error, origen })
                        resolver(r.error)
                        return
                    }
                    if (sinLeer) avisarSinLeer()
                    router.refresh()
                    resolver(null)
                })
            }),
        [aplicar, router],
    )

    const fijados = vista.filter((c) => c.fijadoEn).length
    const motivoNoFijar = useCallback(
        (c: Conversacion): MotivoNoFijar => {
            if (c.fijadoEn) return null
            if (c.archivadoEn) return "Desarchiva el chat antes de fijarlo."
            if (fijados >= CHATS_FIJADOS_MAX) return `Máximo ${CHATS_FIJADOS_MAX} chats fijados.`
            return null
        },
        [fijados],
    )

    const acciones = useMemo<AccionesChat>(
        () => ({
            fijar: (c, valor, origen = "lista") => {
                const motivo = valor ? motivoNoFijar(c) : null
                if (motivo) {
                    setError({ texto: motivo, origen })
                    return
                }
                void ejecutar({ id: c.cliente_id, cambio: { fijadoEn: valor ? new Date().toISOString() : null } }, () => fijarChatAction(c.cliente_id, valor), origen)
            },
            archivar: (c, valor, origen = "lista") =>
                void ejecutar(
                    // Archivar también desfija (igual que la base).
                    { id: c.cliente_id, cambio: valor ? { archivadoEn: new Date().toISOString(), fijadoEn: null } : { archivadoEn: null } },
                    () => archivarChatAction(c.cliente_id, valor),
                    origen,
                ),
            marcarNoLeido: (c, origen = "lista") => {
                alSalirDelChat(c.cliente_id)
                void ejecutar({ id: c.cliente_id, cambio: { noLeidoManual: true } }, () => marcarNoLeidoAction(c.cliente_id, true), origen, true)
            },
            // Con mensajes sin abrir, leerlos es abrir la conversación (la acción los marca leídos); si no, quitar la marca.
            marcarLeido: (c, origen = "lista") =>
                void ejecutar(
                    { id: c.cliente_id, cambio: { sinLeer: 0, noLeidoManual: false } },
                    c.sinLeer > 0 ? () => getConversacionAction(c.cliente_id).then((r) => (r.ok ? { ok: true } : r)) : () => marcarNoLeidoAction(c.cliente_id, false),
                    origen,
                    true,
                ),
            eliminar: (c, origen = "lista") => {
                alSalirDelChat(c.cliente_id)
                void ejecutar({ id: c.cliente_id, quitar: true }, () => eliminarChatAction(c.cliente_id), origen, true)
            },
            asignarEtiquetas: (c, ids, origen = "lista") =>
                ejecutar({ id: c.cliente_id, cambio: { etiquetas: [...ids].sort((a, b) => a - b) } }, () => asignarEtiquetasAction(c.cliente_id, ids), origen),
            asignarCarpetas: (c, ids, origen = "lista") =>
                ejecutar({ id: c.cliente_id, cambio: { carpetas: [...ids].sort((a, b) => a - b) } }, () => carpetasDeClienteAction(c.cliente_id, ids), origen),
        }),
        [ejecutar, motivoNoFijar, alSalirDelChat],
    )

    const valor = useMemo<BandejaCtx>(
        () => ({ conversaciones: vista, etiquetas, carpetas, acciones, motivoNoFijar, error, cerrarError: () => setError(null), abrirGestor }),
        [vista, etiquetas, carpetas, acciones, motivoNoFijar, error, abrirGestor],
    )
    return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}
