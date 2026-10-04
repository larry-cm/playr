import type { CampoFiltro } from "@ui/filtros-select"
import { capitalizar } from "@lib/text"
import type { PerfilRow } from "@action/manager-and-admin/perfiles/get-all-perfiles-action"

export const estadoLabel: Record<PerfilRow["estado"], string> = {
    disponible: "Disponible",
    vendido: "Vendido",
    suspendido: "Suspendido",
    en_soporte: "En soporte",
    reservado: "Reservado (pago por verificar)",
}

export const estadoColor: Record<PerfilRow["estado"], string> = {
    disponible: "#34d399",
    vendido: "var(--color-accent)",
    suspendido: "#f87171",
    en_soporte: "#fbbf24",
    reservado: "#60a5fa",
}

/** Filtros de Perfiles (misma forma que los de Cuentas). "cuenta" filtra por el id de la cuenta y se muestra con su correo. */
export const CAMPOS_PERFILES: CampoFiltro<PerfilRow>[] = [
    { key: "plataforma", todas: "Todas las plataformas", valor: (r) => r.platform_nombre, etiqueta: (r) => capitalizar(r.platform_nombre), width: "max-w-52" },
    { key: "cuenta", todas: "Todos los correos", valor: (r) => String(r.account_id), etiqueta: (r) => r.cuenta_email, width: "max-w-64", ancho: true },
    { key: "estado", todas: "Todos los estados", valor: (r) => r.estado, etiqueta: (r) => estadoLabel[r.estado], orden: Object.keys(estadoLabel), width: "max-w-48" },
]
