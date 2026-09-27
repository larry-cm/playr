"use client"
import { type InputHTMLAttributes, type ReactNode, forwardRef, useId } from "react"
import { TriangleAlert } from "lucide-react"

export type ValidationState = "idle" | "valid" | "invalid";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | string[];
  /** Ayuda neutra bajo el campo (sin ícono de advertencia). Si hay `error`, se muestra el error en su lugar. */
  message?: string | string[];
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  /** El rightIcon lleva dos botones (p. ej. mostrar + copiar): reserva más espacio a la derecha. */
  rightIconWide?: boolean;
  required?: boolean;
  validation?: ValidationState;
}

const borderByValidation: Record<ValidationState, string> = {
  idle: "border-white/[0.1]",
  valid: "border-emerald-500/50 focus:border-emerald-400 focus:ring-emerald-400/40",
  invalid: "border-red-500/50 focus:border-red-400 focus:ring-red-400/40",
}

const textByValidation: Record<ValidationState, string> = {
  idle: "text-secondary",
  valid: "text-emerald-400",
  invalid: "text-red-400",
}

const toList = (value?: string | string[]) => (value ? (Array.isArray(value) ? value : [value]) : [])

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, message, leftIcon, rightIcon, rightIconWide, required, className = "", id, validation, ...rest }, ref) => {
    const autoId = useId()
    const inputId = id ?? autoId
    const messagesId = `${inputId}-mensajes`
    const errors = toList(error)
    const isError = errors.length > 0
    const messages = isError ? errors : toList(message)
    const validationState = isError ? "invalid" : validation ?? "idle"
    const borderClass = borderByValidation[validationState]
    const textClass = isError ? "text-red-400" : textByValidation[validationState]
    const rightPadding = rightIcon ? (rightIconWide ? "pr-20" : "pr-11") : "pr-3.5"

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-secondary">
            {label}{required && <span className="text-accent ml-0.5" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none shrink-0">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-required={required || undefined}
            aria-invalid={isError || validation === "invalid" || undefined}
            aria-describedby={messages.length > 0 ? messagesId : undefined}
            className={`w-full bg-white/5 border rounded-xl py-2.5 text-sm text-white placeholder-muted outline-none transition-all duration-200 focus:border-accent focus:ring-1 focus:ring-accent/40 ${leftIcon ? "pl-10" : "pl-3.5"} ${rightPadding} ${borderClass} ${className}`}
            {...rest}
          />
          {rightIcon && (
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center text-muted shrink-0">
              {rightIcon}
            </div>
          )}
        </div>
        <div id={messagesId} className="flex flex-col gap-0.5 mt-0.5 min-h-5">
          {messages.map((msg, i) => (
            <p key={i} className={`${textClass} text-xs flex items-center gap-1`}>
              {isError && <TriangleAlert className="w-3 h-3 shrink-0" aria-hidden="true" />}
              {msg}
            </p>
          ))}
        </div>
      </div>
    )
  },
)

Input.displayName = "Input"

export default Input
