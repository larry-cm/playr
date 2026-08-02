"use client";

import { LayoutDashboard, LogOut, X } from "lucide-react";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase/client";
import logoPlayr from "@/public/favicon.svg"
import Image from "next/image";

interface NavItem {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    roles: string[];
}

interface AsideProps {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    role: string;
}

const navItems = [
    { name: "Administrar", href: "/administrar", icon: LayoutDashboard, roles: ["admin", "manager", "user"] },
    { name: "Clientes", href: "/administrar/clientes", icon: LayoutDashboard, roles: ["admin", "manager"] },
];
export default function Aside({ sidebarOpen, setSidebarOpen, role }: AsideProps) {
    const pathname = usePathname();
    const router = useRouter();

    const filteredItems = navItems.filter(item => !item.roles || item.roles.includes(role));

    return (
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
                    <Image src={logoPlayr} width="28" height="28" alt="Playr" />
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
                {filteredItems.map((item) => {
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
    );
}
