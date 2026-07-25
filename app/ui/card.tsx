"use client";

export default function Card({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <section className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-2xl p-8 w-full">
            {children}
        </section>
    )
}