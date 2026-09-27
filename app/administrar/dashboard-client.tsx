"use client"

import { Menu } from "lucide-react"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import Aside from "@/app/administrar/aside"
import NotificacionesDrawer, { NotificacionesBell, useNotificaciones } from "@/app/administrar/notificaciones"

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

    // Al abrir el menú móvil el foco entra en él y ESC lo cierra; al cerrarlo vuelve al botón que lo abrió.
    useEffect(() => {
        if (sidebarOpen) {
            wasOpen.current = true
            asideRef.current?.querySelector<HTMLElement>("nav a")?.focus()
            const onKey = (e: KeyboardEvent) => {
                if (e.key === "Escape") setSidebarOpen(false)
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
            <header className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 h-14 bg-background/80 backdrop-blur-xl border-b border-white/6">
                <button
                    ref={menuButtonRef}
                    onClick={() => setSidebarOpen(true)}
                    className="p-3 -ml-3 rounded-xl hover:bg-white/5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    aria-label="Abrir menú"
                    aria-expanded={sidebarOpen}
                    aria-controls="menu-lateral"
                >
                    <Menu className="w-5 h-5 text-secondary" />
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
                    inert={isMobile && !sidebarOpen}
                />

                {/* Main content */}
                {/* Barra nativa: oscura por color-scheme: dark (globals.css), igual que la del html. */}
                <main className="flex-1 min-w-0 overflow-y-auto p-4 pt-18 sm:p-6 sm:pt-20 lg:p-8 [scrollbar-gutter:stable]">
                    <div className="animate-[fadeIn_0.6s_ease-out] motion-reduce:animate-none">
                        {children}
                    </div>
                </main>
            </div>

            {canNotify && (
                <NotificacionesDrawer open={notifs.isOpen} items={notifs.items} onClose={notifs.close} onDelete={notifs.remove} onRefresh={notifs.refresh} />
            )}
        </>
    )
}
