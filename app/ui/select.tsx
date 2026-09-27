"use client"
import { type SelectHTMLAttributes, type ReactNode, forwardRef, useId } from "react"
import { TriangleAlert, ChevronDown } from "lucide-react"

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string | string[];
  leftIcon?: ReactNode;
  options: SelectOption[];
  placeholder?: string;
  /** El placeholder es una opción elegible (value ""): para filtros tipo "Todas las categorías". */
  allowEmpty?: boolean;
  required?: boolean;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, leftIcon, options, placeholder, allowEmpty = false, required, className = "", id, ...rest }, ref) => {
    const autoId = useId()
    const selectId = id ?? autoId
    const errorId = `${selectId}-error`
    const errors = error ? (Array.isArray(error) ? error : [error]) : []

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-secondary">
            {label}{required && <span className="text-accent ml-0.5" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none shrink-0">
              {leftIcon}
            </div>
          )}
          <select
            ref={ref}
            id={selectId}
            aria-required={required || undefined}
            aria-invalid={errors.length > 0 || undefined}
            aria-describedby={errors.length > 0 ? errorId : undefined}
            className={`w-full appearance-none bg-white/5 border rounded-xl py-2.5 text-sm text-white placeholder-muted outline-none transition-all duration-200 focus:border-accent focus:ring-1 focus:ring-accent/40 ${leftIcon ? "pl-10" : "pl-3.5"} pr-10 ${errors.length > 0 ? "border-red-500/50 focus:border-red-400 focus:ring-red-400/40" : "border-white/10"} ${className}`}
            {...rest}
          >
            {placeholder && (
              <option value="" disabled={!allowEmpty} className="bg-background text-muted">
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-background text-white">
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none shrink-0">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
        {errors.length > 0 && (
          <div id={errorId} className="flex flex-col gap-0.5 mt-0.5">
            {errors.map((msg, i) => (
              <p key={i} className="text-red-400 text-xs flex items-center gap-1">
                <TriangleAlert className="w-3 h-3 shrink-0" aria-hidden="true" />
                {msg}
              </p>
            ))}
          </div>
        )}
      </div>
    )
  },
)

Select.displayName = "Select"

export default Select
