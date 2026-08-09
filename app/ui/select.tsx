"use client"
import { type SelectHTMLAttributes, type ReactNode, forwardRef } from "react"
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
  required?: boolean;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, leftIcon, options, placeholder, required, className = "", id, ...rest }, ref) => {
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
          <select
            ref={ref}
            id={id}
            className={`w-full appearance-none bg-white/5 border rounded-xl py-2.5 text-sm text-white placeholder-muted outline-none transition-all duration-200 focus:border-accent focus:ring-1 focus:ring-accent/40 ${leftIcon ? "pl-10" : "pl-3.5"} pr-10 ${error ? "border-red-500/50 focus:border-red-400 focus:ring-red-400/40" : "border-white/10"} ${className}`}
            {...rest}
          >
            {placeholder && (
              <option value="" disabled className="bg-background text-muted">
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
        {error && (
          <div className="flex flex-col gap-0.5 mt-0.5">
            {(Array.isArray(error) ? error : [error]).map((msg, i) => (
              <p key={i} className="text-red-400 text-xs flex items-center gap-1">
                <TriangleAlert className="w-3 h-3 shrink-0" />
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
