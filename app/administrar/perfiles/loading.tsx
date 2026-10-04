"use client"

// Mientras carga: la misma tabla en su estado de carga. Lee ?cuenta= igual que la página, así el filtro de correo
// (y el botón "Limpiar" que trae) ya está puesto y la barra no cambia al llegar los datos.
import { useSearchParams } from "next/navigation"
import PerfilesClient from "@/app/administrar/perfiles/perfiles-client"

export default function Loading() {
    const cuenta = Number(useSearchParams().get("cuenta"))
    return <PerfilesClient initialPerfiles={undefined} initialCuentaId={Number.isInteger(cuenta) && cuenta > 0 ? cuenta : null} />
}
