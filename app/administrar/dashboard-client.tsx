"use client"

import { Menu } from "lucide-react"
import { useState } from "react"
import Aside from "@/app/administrar/aside"
import NotificacionesDrawer, { NotificacionesBell, useNotificaciones } from "@/app/administrar/notificaciones"

export default function DashboardClient({
    children,
    role,
}: Readonly<{
    children: React.ReactNode;
    role: string;
}>) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const canNotify = role === "admin" || role === "manager"
    const notifs = useNotificaciones(canNotify)
    const bell = canNotify && <NotificacionesBell count={notifs.sinVer} onClick={notifs.open} />

    return (
        <>
            {/* Mobile header */}
            <header className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 h-14 bg-background/80 backdrop-blur-xl border-b border-white/6">
                <button
                    onClick={() => setSidebarOpen(true)}
                    className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors"
                    aria-label="Abrir menú"
                >
                    <Menu className="w-5 h-5 text-secondary" />
                </button>
                <span className="text-lg font-bold tracking-tight text-white">Playr</span>
                {bell ? <div className="-mr-2">{bell}</div> : <div className="w-9" />}
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

                {/* Sidebar */}
                <Aside sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} role={role} bell={bell} />

                {/* Main content */}
                {/* Barra nativa: oscura por color-scheme: dark (globals.css), igual que la del html. */}
                <main className="flex-1 min-w-0 overflow-y-auto p-4 pt-18 sm:p-6 sm:pt-20 lg:p-8 [scrollbar-gutter:stable]">
                    <div className="animate-[fadeIn_0.6s_ease-out]">
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
