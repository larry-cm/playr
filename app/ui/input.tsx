"use client"
import { type InputHTMLAttributes, type ReactNode, forwardRef } from "react"
import { TriangleAlert } from "lucide-react"

export type ValidationState = "idle" | "valid" | "invalid";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | string[];
  message?: string | string[];
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
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

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, message, leftIcon, rightIcon, required, className = "", id, validation, ...rest }, ref) => {
    const validationState = validation ?? "idle"
    const borderClass = borderByValidation[validationState]
    const textClass = textByValidation[validationState]
    const messages = error
      ? Array.isArray(error)
        ? error
        : [error]
      : message
        ? Array.isArray(message)
          ? message
          : [message]
        : []

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-secondary">
            {label}{required && <span className="text-accent ml-0.5">*</span>}
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
            id={id}
            className={`w-full bg-white/5 border rounded-xl py-2.5 text-sm text-white placeholder-muted outline-none transition-all duration-200 focus:border-accent focus:ring-1 focus:ring-accent/40 ${leftIcon ? "pl-10" : "pl-3.5"} ${rightIcon ? "pr-10" : "pr-3.5"} ${borderClass} ${className}`}
            {...rest}
          />
          {rightIcon && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted shrink-0">
              {rightIcon}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-0.5 mt-0.5 min-h-5">
          {messages.map((msg, i) => (
            <p key={i} className={`${textClass} text-xs flex items-center gap-1`}>
              <TriangleAlert className="w-3 h-3 shrink-0" />
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
