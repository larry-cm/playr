"use client";

export default function Card({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            {children}
        </section>
    )
}