"use client"

import { Menu } from "lucide-react"
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react"
import Aside, { Insignia } from "@/app/administrar/aside"
import NotificacionesDrawer, { NotificacionesBell, useNotificaciones } from "@/app/administrar/notificaciones"
import { useMensajesSinLeer } from "@/app/administrar/use-mensajes-sin-leer"

// Debajo de lg el menú lateral es un panel que se abre y cierra; en escritorio siempre está visible.
const mobileQuery = "(max-width: 63.999rem)"
const subscribeMobile = (onChange: () => void) => {
    const mql = window.matchMedia(mobileQuery)
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
}
const getIsMobile = () => window.matchMedia(mobileQuery).matches
// En el servidor no se sabe el ancho: se asume escritorio para no dejar el menú inerte antes de hidratar.
const getIsMobileServer = () => false

// Rol ya resuelto por el layout: lo usa el esqueleto de /administrar (loading.tsx), que no recibe props, para pintar la vista correcta.
const RolContext = createContext("")
export const useRol = () => useContext(RolContext)

export default function DashboardClient({
    children,
    role,
}: Readonly<{
    children: React.ReactNode;
    role: string;
}>) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const isMobile = useSyncExternalStore(subscribeMobile, getIsMobile, getIsMobileServer)
    const menuButtonRef = useRef<HTMLButtonElement>(null)
    const asideRef = useRef<HTMLElement>(null)
    const wasOpen = useRef(false)
    const canNotify = role === "admin" || role === "manager"
    const notifs = useNotificaciones(canNotify)
    const bell = canNotify && <NotificacionesBell count={notifs.sinVer} onClick={notifs.open} />
    const sinLeer = useMensajesSinLeer(canNotify)

    // Menú móvil abierto: lo de atrás (header y main) queda inerte y el foco no sale del menú.
    const behindInert = isMobile && sidebarOpen

    // Al abrir el menú móvil el foco entra en él, Tab da la vuelta dentro y ESC lo cierra; al cerrarlo vuelve al botón que lo abrió.
    useEffect(() => {
        if (sidebarOpen) {
            wasOpen.current = true
            asideRef.current?.querySelector<HTMLElement>("nav a")?.focus()
            const onKey = (e: KeyboardEvent) => {
                if (e.key === "Escape") {
                    setSidebarOpen(false)
                    return
                }
                const aside = asideRef.current
                if (e.key !== "Tab" || !aside || !window.matchMedia(mobileQuery).matches) return
                const focusables = Array.from(
                    aside.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'),
                ).filter((el) => el.getClientRects().length > 0)
                if (focusables.length === 0) return
                const first = focusables[0]
                const last = focusables[focusables.length - 1]
                const active = document.activeElement
                if (e.shiftKey && (active === first || !aside.contains(active))) {
                    e.preventDefault()
                    last.focus()
                } else if (!e.shiftKey && (active === last || !aside.contains(active))) {
                    e.preventDefault()
                    first.focus()
                }
            }
            document.addEventListener("keydown", onKey)
            return () => document.removeEventListener("keydown", onKey)
        }
        if (wasOpen.current) {
            wasOpen.current = false
            menuButtonRef.current?.focus()
        }
    }, [sidebarOpen])

    return (
        <>
            {/* Mobile header */}
            <header inert={behindInert} className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 h-14 bg-background/80 backdrop-blur-xl border-b border-white/6">
                <button
                    ref={menuButtonRef}
                    onClick={() => setSidebarOpen(true)}
                    className="relative p-3 -ml-3 rounded-xl hover:bg-white/5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    aria-label={sinLeer > 0 ? `Abrir menú, ${sinLeer} mensajes sin leer` : "Abrir menú"}
                    aria-expanded={sidebarOpen}
                    aria-controls="menu-lateral"
                >
                    <Menu className="w-5 h-5 text-secondary" />
                    {/* Mensajes sin leer a la vista sin abrir el menú (misma posición que la de la campana). */}
                    <Insignia count={sinLeer} className="absolute top-1.5 right-1.5" />
                </button>
                <span className="text-lg font-bold tracking-tight text-white">Playr</span>
                {bell ? <div className="-mr-3">{bell}</div> : <div className="w-11" />}
            </header>

            {/* Alto fijo de pantalla: el aside queda quieto y cada página scrollea dentro del main. */}
            <div className="flex h-dvh overflow-hidden">
                {/* Overlay */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Sidebar: cerrado en móvil queda fuera de pantalla e inerte (sin foco ni lector de pantalla). */}
                <Aside
                    ref={asideRef}
                    sidebarOpen={sidebarOpen}
                    setSidebarOpen={setSidebarOpen}
                    role={role}
                    bell={bell}
                    badges={{ "/administrar/mensajes": sinLeer }}
                    inert={isMobile && !sidebarOpen}
                />

                {/* Main content */}
                {/* Barra nativa: oscura por color-scheme: dark (globals.css), igual que la del html. */}
                <main inert={behindInert} className="flex-1 min-w-0 overflow-y-auto p-4 pt-18 sm:p-6 sm:pt-20 lg:p-8 [scrollbar-gutter:stable]">
                    <div className="animate-[fadeIn_0.6s_ease-out] motion-reduce:animate-none">
                        <RolContext value={role}>{children}</RolContext>
                    </div>
                </main>
            </div>

            {canNotify && (
                <NotificacionesDrawer open={notifs.isOpen} items={notifs.items} onClose={notifs.close} onDelete={notifs.remove} onClear={notifs.clear} onRefresh={notifs.refresh} />
            )}
        </>
    )
}
