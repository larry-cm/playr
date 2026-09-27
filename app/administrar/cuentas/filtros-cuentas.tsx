import type { CampoFiltro } from "@ui/filtros-select"
import { capitalizar } from "@lib/text"
import type { CuentaRow } from "@action/manager-and-admin/cuentas/get-all-cuentas-action"

/** Filtros de Cuentas (misma forma que los de Perfiles). */
export const CAMPOS_CUENTAS: CampoFiltro<CuentaRow>[] = [
    { key: "plataforma", todas: "Todas las plataformas", valor: (r) => r.platform_nombre, etiqueta: (r) => capitalizar(r.platform_nombre), width: "max-w-52" },
    { key: "cuenta", todas: "Todos los correos", valor: (r) => String(r.id), etiqueta: (r) => r.email, width: "max-w-64", ancho: true },
]
