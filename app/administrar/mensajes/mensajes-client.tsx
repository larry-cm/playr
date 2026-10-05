"use client"

import { useCallback, useId, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, MessageCircle } from "lucide-react"
import Card from "@ui/card"
import Alert from "@ui/alert"
import AutoRefresh from "@ui/auto-refresh"
import type { Bandeja, Carpeta, Conversacion, Etiqueta } from "@action/manager-and-admin/mensajes/mensajes-action"
import { BandejaProvider, useBandeja } from "@/app/administrar/mensajes/bandeja-contexto"
import { filtrarConversaciones, ordenarConversaciones, tieneNoLeido, type Pestana } from "@/app/administrar/mensajes/bandeja-util"
import FiltrosBandeja from "@/app/administrar/mensajes/filtros-bandeja"
import ListaChats from "@/app/administrar/mensajes/lista-chats"
import ChatCliente, { type EstadoPanel } from "@/app/administrar/mensajes/chat-cliente"
import GestorEtiquetas from "@/app/administrar/mensajes/gestor-etiquetas"
import GestorCarpetas from "@/app/administrar/mensajes/gestor-carpetas"
import type { SeccionPanel } from "@/app/administrar/mensajes/panel-detalles"

interface VistaProps {
    cargando: boolean
    seleccionado: string | null
    onElegir: (clienteId: string | null) => void
    panel: EstadoPanel
    onPanel: (p: EstadoPanel) => void
    gestor: "etiquetas" | "carpetas" | null
    onCerrarGestor: () => void
}

function VistaBandeja({ cargando, seleccionado, onElegir, panel, onPanel, gestor, onCerrarGestor }: Readonly<VistaProps>) {
    const { conversaciones, etiquetas, carpetas, error, cerrarError } = useBandeja()
    const [busqueda, setBusqueda] = useState("")
    const [pestanaElegida, setPestana] = useState<Pestana>("todos")
    const [filtroElegido, setFiltro] = useState<number[]>([])
    const [archivados, setArchivados] = useState(false)
    const listaId = useId()
    const enfocado = useRef(0)

    // Una carpeta o etiqueta borrada (aquí o por otro asesor) deja de filtrar sola.
    const pestana = typeof pestanaElegida === "number" && !carpetas.some((c) => c.id === pestanaElegida) ? "todos" : pestanaElegida
    const filtro = useMemo(() => filtroElegido.filter((id) => etiquetas.some((e) => e.id === id)), [filtroElegido, etiquetas])

    const lista = useMemo(
        () => (cargando ? undefined : ordenarConversaciones(filtrarConversaciones(conversaciones, { pestana, archivados, etiquetas: filtro, busqueda, abierto: seleccionado }))),
        [cargando, conversaciones, pestana, archivados, filtro, busqueda, seleccionado],
    )
    const archivadas = conversaciones.filter((c) => c.archivadoEn)
    const verArchivados = !cargando && !archivados && pestana === "todos" && !busqueda.trim() && filtro.length === 0 && archivadas.length > 0

    const vacio = archivados
        ? "No hay chats archivados."
        : busqueda.trim()
          ? "Ningún cliente coincide."
          : filtro.length
            ? "Ningún chat tiene esas etiquetas."
            : pestana === "no-leidos"
              ? "No hay chats sin leer."
              : typeof pestana === "number"
                ? "Esta carpeta está vacía. Agrega chats desde el menú ⋯ de cada chat o en Carpetas."
                : "Aún no hay mensajes de clientes."

    const abrirPanel = (seccion: SeccionPanel) => onPanel({ abierto: true, seccion, apertura: panel.apertura + 1 })
    // El panel toma el foco solo una vez por apertura (no al cambiar de chat con el panel abierto).
    const debeEnfocar = useCallback((apertura: number) => {
        if (apertura === enfocado.current) return false
        enfocado.current = apertura
        return true
    }, [])

    return (
        // Alto fijo: lo que queda de la pantalla bajo el encabezado de la página (padding de <main> + PageHeader + gap), con un
        // mínimo para pantallas muy bajas. Lista y chat hacen scroll por dentro; nada empuja la página.
        <div className="grid h-[calc(100dvh-11.5rem)] min-h-[26rem] grid-cols-1 grid-rows-1 gap-4 sm:h-[calc(100dvh-11rem)] lg:h-[calc(100dvh-8.5rem)] lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
            {/* Conversaciones nuevas y sin leer aparecen solas; la conversación abierta se refresca por su cuenta. */}
            <AutoRefresh cadaMs={10_000} activo={!cargando} />

            <Card padding="p-3" className={`flex min-h-0 min-w-0 flex-col gap-3 ${seleccionado ? "hidden lg:flex" : ""}`}>
                <FiltrosBandeja
                    cargando={cargando}
                    busqueda={busqueda}
                    onBusqueda={setBusqueda}
                    pestana={pestana}
                    onPestana={(p) => {
                        setPestana(p)
                        setArchivados(false)
                    }}
                    etiquetasFiltro={filtro}
                    onEtiquetasFiltro={setFiltro}
                    archivados={archivados}
                    onSalirArchivados={() => setArchivados(false)}
                    listaId={listaId}
                />
                {/* Los errores del panel también se ven acá si el panel ya se cerró (p. ej. al eliminar el chat). */}
                {error && (error.origen === "lista" || !panel.abierto) && <Alert variant="error" message={error.texto} onDismiss={cerrarError} />}
                <ListaChats
                    id={listaId}
                    lista={lista}
                    seleccionado={seleccionado}
                    onElegir={onElegir}
                    archivados={verArchivados ? { n: archivadas.length, noLeidos: archivadas.filter(tieneNoLeido).length } : null}
                    onAbrirArchivados={() => setArchivados(true)}
                    vacio={vacio}
                />
            </Card>

            {seleccionado ? (
                <ChatCliente
                    key={seleccionado}
                    clienteId={seleccionado}
                    onVolver={() => onElegir(null)}
                    panel={panel}
                    onAbrirPanel={abrirPanel}
                    onCerrarPanel={() => onPanel({ ...panel, abierto: false })}
                    debeEnfocarPanel={debeEnfocar}
                />
            ) : (
                <Card padding="px-4 py-16" className="hidden h-full flex-col items-center justify-center text-center lg:flex">
                    <MessageCircle className="mb-3 h-7 w-7 text-secondary" aria-hidden="true" />
                    <p className="text-sm text-secondary">Elige un cliente para ver su conversación.</p>
                </Card>
            )}

            <GestorEtiquetas abierto={gestor === "etiquetas"} onCerrar={onCerrarGestor} />
            <GestorCarpetas abierto={gestor === "carpetas"} onCerrar={onCerrarGestor} />
        </div>
    )
}

const SIN_CHATS: Conversacion[] = []
const SIN_ETIQUETAS: Etiqueta[] = []
const SIN_CARPETAS: Carpeta[] = []

/** undefined = cargando · null = error. */
export default function MensajesClient({ bandeja, clienteInicial }: Readonly<{ bandeja: Bandeja | null | undefined; clienteInicial: string | null }>) {
    const router = useRouter()
    const [seleccionado, setSeleccionado] = useState<string | null>(clienteInicial)
    const [panel, setPanel] = useState<EstadoPanel>({ abierto: false, seccion: "inicio", apertura: 0 })
    const [gestor, setGestor] = useState<"etiquetas" | "carpetas" | null>(null)

    const elegir = useCallback(
        (clienteId: string | null) => {
            setSeleccionado(clienteId)
            router.replace(clienteId ? `/administrar/mensajes?cliente=${clienteId}` : "/administrar/mensajes", { scroll: false })
        },
        [router],
    )
    // Eliminar o marcar "no leído" el chat abierto lo cierra (abierto, se volvería a leer en la siguiente carga).
    const alSalirDelChat = useCallback((clienteId: string) => {
        if (clienteId === seleccionado) elegir(null)
    }, [seleccionado, elegir])

    // El chat abierto se está leyendo: en la lista no cuenta como no leído (su carga lo marca leído en el servidor).
    const conversaciones = useMemo(
        () => (bandeja?.conversaciones ?? SIN_CHATS).map((c) => (c.cliente_id === seleccionado && (c.sinLeer > 0 || c.noLeidoManual) ? { ...c, sinLeer: 0, noLeidoManual: false } : c)),
        [bandeja, seleccionado],
    )

    if (bandeja === null) {
        return (
            <Card padding="px-4 py-12" className="flex flex-col items-center justify-center text-center">
                <AlertCircle className="mb-3 h-7 w-7 text-red-400" aria-hidden="true" />
                <p className="text-sm text-white/70">No pudimos cargar los mensajes.</p>
            </Card>
        )
    }

    return (
        <BandejaProvider conversaciones={conversaciones} etiquetas={bandeja?.etiquetas ?? SIN_ETIQUETAS} carpetas={bandeja?.carpetas ?? SIN_CARPETAS} abrirGestor={setGestor} alSalirDelChat={alSalirDelChat}>
            <VistaBandeja
                cargando={bandeja === undefined}
                seleccionado={seleccionado}
                onElegir={elegir}
                panel={panel}
                onPanel={setPanel}
                gestor={gestor}
                onCerrarGestor={() => setGestor(null)}
            />
        </BandejaProvider>
    )
}
