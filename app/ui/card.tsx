"use client"

interface CardProps {
    children: React.ReactNode;
    className?: string;
    /** Padding interno. p-6 en todo el panel; las pantallas de acceso (login, recuperar) usan p-8. */
    padding?: string;
}

export default function Card({
    children,
    className = "",
    padding = "p-6",
}: Readonly<CardProps>) {
    return (
        <section className={`bg-white/3 backdrop-blur-xl border border-white/6 rounded-2xl shadow-2xl w-full ${padding} ${className}`}>
            {children}
        </section>
    )
}
