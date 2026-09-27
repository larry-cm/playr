"use client"
import { type ChangeEvent, useState } from "react"
import { Lock, Eye, EyeOff } from "lucide-react"
import Input, { type ValidationState } from "@ui/input"

interface PasswordInputProps {
  id?: string;
  name?: string;
  label?: string;
  error?: string | string[];
  message?: string | string[];
  placeholder?: string;
  value?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  required?: boolean;
  validation?: ValidationState;
  /** "current-password" (login) o "new-password" (alta, cambio de contraseña). */
  autoComplete?: string;
  disabled?: boolean;
}

export default function PasswordInput({
  id,
  name = "password",
  label = "Contraseña",
  error,
  message,
  placeholder = "••••••••",
  value,
  onChange,
  onBlur,
  required,
  validation,
  autoComplete = "current-password",
  disabled,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <Input
      id={id}
      name={name}
      type={showPassword ? "text" : "password"}
      label={label}
      placeholder={placeholder}
      error={error}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      required={required}
      validation={validation}
      message={message}
      autoComplete={autoComplete}
      disabled={disabled}
      leftIcon={<Lock className="w-4 h-4" />}
      rightIcon={
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          aria-label="Mostrar contraseña"
          aria-pressed={showPassword}
          className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors cursor-pointer hover:text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      }
    />
  )
}
