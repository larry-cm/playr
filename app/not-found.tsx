import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import Card from "@ui/card"
import PlayrLogo from "@ui/playr-logo"

export const metadata: Metadata = {
  title: "Página no encontrada",
}

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md">
        <Card padding="p-8">
          <div className="flex flex-col items-center text-center">
            <PlayrLogo />
            <p className="text-5xl font-bold text-accent tracking-tight mt-6">404</p>
            <h1 className="text-2xl font-bold text-white tracking-tight mt-2">Página no encontrada</h1>
            <p className="text-secondary text-sm mt-1.5 leading-relaxed">
              La dirección que buscas no existe o se movió.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 px-5 text-sm font-medium text-white bg-gradient-to-r from-accent to-[#7c3aed] hover:from-accent-hover hover:to-accent hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al inicio
            </Link>
          </div>
        </Card>
      </div>
    </main>
  )
}
