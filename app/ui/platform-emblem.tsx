import { marca } from "@lib/marcas"

interface PlatformEmblemProps {
    /** Nombre de la plataforma en business.platform. */
    platform: string;
    /** Alto del logo en px (el emblema de texto se ajusta a la misma altura). */
    size?: number;
    className?: string;
}

/**
 * Emblema de una plataforma en su color de marca: el logo oficial si existe y, si no, su nombre comercial como texto.
 * Es decorativo: quien lo usa siempre muestra también el nombre en texto.
 */
export default function PlatformEmblem({ platform, size = 32, className = "" }: PlatformEmblemProps) {
    const { nombre, color, logo } = marca(platform)

    if (logo) {
        return (
            <svg viewBox="0 0 24 24" width={size} height={size} fill={color} className={`shrink-0 ${className}`} aria-hidden="true">
                <path d={logo} />
            </svg>
        )
    }

    return (
        <span
            className={`font-extrabold leading-none tracking-tight whitespace-nowrap ${className}`}
            style={{ color, fontSize: size * 0.75 }}
            aria-hidden="true"
        >
            {nombre}
        </span>
    )
}
