"use client";
import { type ChangeEvent, useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import Input, { type ValidationState } from "@ui/input";

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
}

export default function PasswordInput({
  id = "password",
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
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

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
      leftIcon={<Lock className="w-4 h-4" />}
      rightIcon={
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          tabIndex={-1}
          aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="p-0.5 rounded-md transition-colors cursor-pointer hover:text-white"
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      }
    />
  );
}
