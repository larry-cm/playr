"use client"
import { type ButtonHTMLAttributes, type ReactNode } from "react"
import { LoaderCircle } from "lucide-react"

type ButtonVariant = "primary" | "secondary" | "ghost" | "outline";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-accent to-[#7c3aed] text-white hover:from-accent-hover hover:to-accent hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] active:scale-[0.98] disabled:active:scale-100 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-none",
  secondary:
    "bg-white/[0.05] border border-white/[0.1] text-white hover:bg-white/[0.08] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed",
  ghost:
    "text-secondary hover:text-white hover:bg-white/5 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed",
  outline:
    "border border-white/[0.1] text-white bg-transparent hover:bg-white/5 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed",
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: "py-1.5 px-3 text-xs rounded-lg gap-1.5",
  md: "py-2 px-4 text-sm rounded-xl gap-2",
  lg: "py-2.5 px-5 text-sm rounded-xl gap-2",
}

export default function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  className = "",
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || isLoading}
      className={`relative inline-flex items-center justify-center font-medium transition-all duration-200 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...rest}
    >
      {isLoading ? (
        <LoaderCircle className="animate-spin w-5 h-5" />
      ) : leftIcon ? (
        <span className="shrink-0">{leftIcon}</span>
      ) : null}
      {isLoading ? <span>{children}</span> : children}
      {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  )
}
