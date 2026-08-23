"use client"
import { type InputHTMLAttributes } from "react"
import { Check } from "lucide-react"

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "children"> {
  label: string;
  error?: string | string[];
}

export default function Checkbox({ label, error, id, className = "", ...rest }: CheckboxProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="flex items-center gap-2 cursor-pointer group">
        <div className="relative">
          <input type="checkbox" id={id} className="peer sr-only" {...rest} />
          <div className="w-4 h-4 rounded border border-white/15 bg-white/3 peer-checked:bg-accent peer-checked:border-accent transition-all duration-200 peer-focus-visible:ring-1 peer-focus-visible:ring-accent/40" />
          <Check className="absolute inset-0 w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200 pointer-events-none" strokeWidth={3} />
        </div>
        <span className="text-sm text-secondary group-hover:text-white transition-colors">{label}</span>
      </label>
      {error && (
        <div className="flex flex-col gap-0.5 mt-1 ml-6">
          {(Array.isArray(error) ? error : [error]).map((msg, i) => (
            <p key={i} className="text-red-400 text-xs">{msg}</p>
          ))}
        </div>
      )}
    </div>
  )
}
