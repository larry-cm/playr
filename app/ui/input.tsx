"use client";
import { type InputHTMLAttributes, type ReactNode, forwardRef } from "react";
import { TriangleAlert } from "lucide-react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | string[];
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leftIcon, rightIcon, className = "", id, ...rest }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-secondary">
            {label}
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
            className={`w-full bg-white/[0.05] border rounded-xl py-2.5 text-sm text-white placeholder-muted outline-none transition-all duration-200 focus:border-accent focus:ring-1 focus:ring-accent/40 ${leftIcon ? "pl-10" : "pl-3.5"} ${rightIcon ? "pr-10" : "pr-3.5"} ${error ? "border-red-500/50 focus:border-red-400 focus:ring-red-400/40" : "border-white/[0.1]"} ${className}`}
            {...rest}
          />
          {rightIcon && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted shrink-0">
              {rightIcon}
            </div>
          )}
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
    );
  },
);

Input.displayName = "Input";

export default Input;
