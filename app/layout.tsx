import type { Metadata } from "next"
import { Outfit } from "next/font/google"
import "./globals.css"
import SesionFetch from "@/app/sesion-fetch"

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "Playr | Maneja tus cuentas y perfiles de manera sencilla",
    template: "%s · Playr",
  },
  // App privada: fuera de buscadores (ver también app/robots.ts).
  robots: { index: false, follow: false },
  description: "Playr es una aplicación web que te permite gestionar tus cuentas y perfiles de manera sencilla y eficiente. Con Playr, puedes organizar tus plataformas de streaming, facilitando el acceso y la administración de tu información y credenciales.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${outfit.className} h-full antialiased bg-background`}
    >
      <body className="min-h-full flex flex-col">
        <SesionFetch />
        {children}
      </body>
    </html>
  )
}
