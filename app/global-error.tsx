"use client"

import { useEffect } from "react"
import "./globals.css"

// Reemplaza al layout raíz cuando este falla, por eso trae su propio <html>/<body>
// y no usa componentes que dependan de él.
export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string }
  reset: () => void
}>) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="es" className="h-full antialiased bg-background">
      <body className="min-h-full flex flex-col">
        <title>Error · Playr</title>
        <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
          <section
            role="alert"
            className="w-full max-w-md bg-white/3 border border-white/6 rounded-2xl shadow-2xl p-8 text-center"
          >
            <h1 className="text-2xl font-bold text-white tracking-tight">Algo salió mal</h1>
            <p className="text-secondary text-sm mt-1.5 leading-relaxed">
              Ocurrió un error inesperado. Intenta de nuevo en unos segundos.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-6 w-full rounded-xl py-2.5 px-5 text-sm font-medium text-white bg-gradient-to-r from-accent to-[#7c3aed] hover:from-accent-hover hover:to-accent transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Reintentar
            </button>
          </section>
        </main>
      </body>
    </html>
  )
}
