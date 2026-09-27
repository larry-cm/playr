"use client"
import { type ReactNode, useEffect, useRef } from "react"
import { CircleCheck, CircleAlert, Info, TriangleAlert } from "lucide-react"

type AlertVariant = "success" | "error" | "warning" | "info";

interface AlertProps {
  variant?: AlertVariant;
  message: ReactNode;
  icon?: ReactNode;
  onDismiss?: () => void;
  /** Milisegundos tras los que se llama a onDismiss solo (pensado para avisos de éxito). */
  autoDismissMs?: number;
}

const variantStyles: Record<AlertVariant, { container: string; text: string; defaultIcon: ReactNode }> = {
  success: {
    container: "bg-emerald-500/10 border border-emerald-500/20",
    text: "text-emerald-400",
    defaultIcon: <CircleCheck className="w-5 h-5 shrink-0" aria-hidden="true" />,
  },
  error: {
    container: "bg-red-500/10 border border-red-500/20",
    text: "text-red-400",
    defaultIcon: <CircleAlert className="w-5 h-5 shrink-0" aria-hidden="true" />,
  },
  warning: {
    container: "bg-amber-500/10 border border-amber-500/20",
    text: "text-amber-400",
    defaultIcon: <TriangleAlert className="w-5 h-5 shrink-0" aria-hidden="true" />,
  },
  info: {
    container: "bg-blue-500/10 border border-blue-500/20",
    text: "text-blue-400",
    defaultIcon: <Info className="w-5 h-5 shrink-0" aria-hidden="true" />,
  },
}

export default function Alert({ variant = "info", message, icon, onDismiss, autoDismissMs }: AlertProps) {
  const { container, text, defaultIcon } = variantStyles[variant]
  const onDismissRef = useRef(onDismiss)
  useEffect(() => {
    onDismissRef.current = onDismiss
  })

  useEffect(() => {
    if (!autoDismissMs) return
    const t = window.setTimeout(() => onDismissRef.current?.(), autoDismissMs)
    return () => window.clearTimeout(t)
  }, [autoDismissMs, message])

  return (
    // Los errores interrumpen al lector de pantalla; el resto se anuncia sin cortar lo que está leyendo.
    <div
      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${container} ${text}`}
      role={variant === "error" ? "alert" : "status"}
    >
      {icon ?? defaultIcon}
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar"
          className="-my-3 -mr-3 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-lg opacity-60 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          <span aria-hidden="true">&times;</span>
        </button>
      )}
    </div>
  )
}
