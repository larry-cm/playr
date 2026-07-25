"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { supabase } from "@/app/lib/supabase/client";

const navItems = [
    { name: "Administrar", href: "/administrar", icon: LayoutDashboard },
];

export default function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const pathname = usePathname();
    const router = useRouter();
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
                <aside
                    className={[
                        "fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-background border-r border-white/6 p-4",
                        "transition-transform duration-300 ease-in-out",
                        "lg:static lg:translate-x-0",
                        sidebarOpen ? "translate-x-0" : "-translate-x-full",
                    ].join(" ")}
                >
                    {/* Logo */}
                    <div className="flex items-center justify-between px-2 py-3 mb-6">
                        <Link href="/administrar" className="flex items-center gap-2.5">
                            <svg width="28" height="28" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect width="36" height="36" rx="10" fill="url(#side-logo-grad)" />
                                <path d="M13 10.5L24 18L13 25.5V10.5Z" fill="white" />
                                <defs>
                                    <linearGradient id="side-logo-grad" x1="0" y1="0" x2="36" y2="36">
                                        <stop stopColor="#8b5cf6" />
                                        <stop offset="1" stopColor="#6366f1" />
                                    </linearGradient>
                                </defs>
                            </svg>
                            <span className="text-xl font-bold tracking-tight text-white">Playr</span>
                        </Link>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="lg:hidden p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                            aria-label="Cerrar menú"
                        >
                            <X className="w-4 h-4 text-secondary" />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 space-y-1">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setSidebarOpen(false)}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
                                        ? "bg-accent/10 border border-accent/20 text-accent"
                                        : "text-secondary border border-transparent hover:text-white hover:bg-white/5"
                                        }`}
                                >
                                    <Icon className="w-4 h-4 shrink-0" />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Logout */}
                    <div className="pt-4 mt-4 border-t border-white/6">
                        <button
                            onClick={async () => {
                                await supabase.auth.signOut();
                                router.push("/");
                            }}
                            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm text-secondary hover:text-white hover:bg-white/5 transition-all duration-200"
                        >
                            <LogOut className="w-4 h-4 shrink-0" />
                            Cerrar sesión
                        </button>
                    </div>
                </aside>

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
