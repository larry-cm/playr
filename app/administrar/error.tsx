"use client"

import { useEffect } from "react"
import { TriangleAlert } from "lucide-react"
import Button from "@ui/button"
import Card from "@ui/card"

// Error dentro del panel: se muestra en el área de contenido y conserva el menú lateral.
export default function AdministrarError({
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
    <Card className="max-w-lg">
      <div className="flex flex-col items-start gap-3" role="alert">
        <TriangleAlert className="w-8 h-8 text-red-400" aria-hidden />
        <h1 className="text-xl font-bold tracking-tight">No se pudo cargar esta sección</h1>
        <p className="text-secondary text-sm leading-relaxed">
          Ocurrió un error inesperado. Intenta de nuevo; si persiste, recarga la página.
        </p>
        <Button className="mt-2" onClick={reset}>
          Reintentar
        </Button>
      </div>
    </Card>
  )
}
