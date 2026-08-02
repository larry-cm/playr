"use client";

import { LayoutDashboard, Menu } from "lucide-react";
import { useState } from "react";
import Aside from "@/app/administrar/aside";

const navItems = [
    { name: "Administrar", href: "/administrar", icon: LayoutDashboard, roles: ["admin", "manager", "user"] },
];

export default function DashboardClient({
    children,
    role,
}: Readonly<{
    children: React.ReactNode;
    role: string;
}>) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

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
                <div className="w-9" />
            </header>

            <div className="flex min-h-screen">
                {/* Overlay */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Sidebar */}
                <Aside items={navItems} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} role={role} />

                {/* Main content */}
                <main className="flex-1 p-4 sm:p-6 lg:p-8 pt-14 lg:pt-8 overflow-auto">
                    <div className="animate-[fadeIn_0.6s_ease-out]">
                        {children}
                    </div>
                </main>
            </div>
        </>
    );
}
