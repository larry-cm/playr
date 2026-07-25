"use client";

interface CardProps {
    children: React.ReactNode;
    className?: string;
}

export default function Card({
    children,
    className = "",
}: Readonly<CardProps>) {
    return (
        <section className={`bg-white/3 backdrop-blur-xl border border-white/6 rounded-2xl shadow-2xl p-8 w-full ${className}`}>
            {children}
        </section>
    )
}