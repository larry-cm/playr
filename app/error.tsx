"use client"

import { useEffect } from "react"
import { TriangleAlert } from "lucide-react"
import Button from "@ui/button"
import Card from "@ui/card"

export default function AppError({
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
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md">
        <Card padding="p-8">
          <div className="flex flex-col items-center text-center" role="alert">
            <TriangleAlert className="w-10 h-10 text-red-400" aria-hidden />
            <h1 className="text-2xl font-bold text-white tracking-tight mt-4">Algo salió mal</h1>
            <p className="text-secondary text-sm mt-1.5 leading-relaxed">
              Ocurrió un error inesperado. Intenta de nuevo en unos segundos.
            </p>
            <Button size="lg" className="mt-6 w-full" onClick={reset}>
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    </main>
  )
}
