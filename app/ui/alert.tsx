"use client"
import { type ReactNode } from "react"
import { CircleCheck, CircleAlert, Info, TriangleAlert } from "lucide-react"

type AlertVariant = "success" | "error" | "warning" | "info";

interface AlertProps {
  variant?: AlertVariant;
  message: string;
  icon?: ReactNode;
  onDismiss?: () => void;
}

const variantStyles: Record<AlertVariant, { container: string; text: string; defaultIcon: ReactNode }> = {
  success: {
    container: "bg-emerald-500/10 border border-emerald-500/20",
    text: "text-emerald-400",
    defaultIcon: <CircleCheck className="w-5 h-5 shrink-0" />,
  },
  error: {
    container: "bg-red-500/10 border border-red-500/20",
    text: "text-red-400",
    defaultIcon: <CircleAlert className="w-5 h-5 shrink-0" />,
  },
  warning: {
    container: "bg-amber-500/10 border border-amber-500/20",
    text: "text-amber-400",
    defaultIcon: <TriangleAlert className="w-5 h-5 shrink-0" />,
  },
  info: {
    container: "bg-blue-500/10 border border-blue-500/20",
    text: "text-blue-400",
    defaultIcon: <Info className="w-5 h-5 shrink-0" />,
  },
}

export default function Alert({ variant = "info", message, icon, onDismiss }: AlertProps) {
  const { container, text, defaultIcon } = variantStyles[variant]

  return (
    <div className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${container} ${text}`} role="alert">
      {icon ?? defaultIcon}
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
          &times;
        </button>
      )}
    </div>
  )
}
