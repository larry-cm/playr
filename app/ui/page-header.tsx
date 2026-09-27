import type { ComponentType, ReactNode } from "react"

interface PageHeaderProps {
    title: string
    description: string
}

/**
 * Encabezado de cada página del panel. Todas llevan título + una línea de descripción (truncada en escritorio),
 * así el contenido arranca a la misma altura en todos los módulos y no "salta" al navegar.
 */
export default function PageHeader({ title, description }: Readonly<PageHeaderProps>) {
    return (
        <header>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-secondary md:truncate" title={description}>
                {description}
            </p>
        </header>
    )
}

interface SectionHeaderProps {
    icon: ComponentType<{ className?: string }>
    title: string
    description?: ReactNode
    /** Botones a la derecha (p. ej. actualizar). */
    action?: ReactNode
}

/** Encabezado de una sección o tarjeta: ícono 20px en caja de 40px + título text-lg. Igual en tarjetas y sobre tablas. */
export function SectionHeader({ icon: Icon, title, description, action }: Readonly<SectionHeaderProps>) {
    return (
        <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
                <div className="shrink-0 rounded-xl bg-accent/10 p-2.5">
                    <Icon className="h-5 w-5 text-accent" />
                </div>
                <div className="min-w-0">
                    <h2 className="text-lg font-semibold leading-tight">{title}</h2>
                    {description && <p className="mt-0.5 text-xs text-secondary">{description}</p>}
                </div>
            </div>
            {action}
        </div>
    )
}
