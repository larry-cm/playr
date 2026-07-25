"use client";

export default function Card({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <section className="bg-white/3 backdrop-blur-xl border border-white/6 rounded-2xl shadow-2xl p-8 w-full">
            {children}
        </section>
    )
}