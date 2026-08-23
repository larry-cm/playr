"use client"

import { Mail } from "lucide-react"
import { type LoginState, loginAction } from "@action/login/login-action"
import { useActionState, useState } from "react"
import { validateEmail } from "@lib/validation"
import Alert from "@ui/alert"
import Button from "@ui/button"
import Card from "@ui/card"
import Input, { type ValidationState } from "@ui/input"
import Link from "next/link"
import PasswordInput from "@ui/password-input"
import PlayrLogo from "@ui/playr-logo"

const initialState: LoginState = { success: false, errors: {} }

function getValidation(
  touched: boolean,
  error: string | null,
  value: string,
  required: boolean,
): ValidationState {
  if (!touched) return "idle"
  if (error) return "invalid"
  if (required && !value) return "invalid"
  return "valid"
}

export default function Home() {
  const [state, action, isLoading] = useActionState(loginAction, initialState)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [touched, setTouched] = useState({ email: false, password: false })

  const touch = (field: "email" | "password") => {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  const emailError = validateEmail(email)
  const passwordError = !password ? "Ingresa una contraseña." : null

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md animate-[fadeIn_0.6s_ease-out]">
        <Card>
          <div className="flex flex-col items-center mb-8">
            <PlayrLogo />
            <h1 className="text-2xl font-bold text-white tracking-tight mt-5">
              Inicio de sesión
            </h1>
            <p className="text-secondary text-sm mt-1.5 text-center leading-relaxed">
              Ingresa tus credenciales para acceder a tu cuenta
            </p>
          </div>

          {state?.success && (
            <div className="mb-6">
              <Alert variant="success" message="Has iniciado sesión correctamente." />
            </div>
          )}

          {state?.message && (
            <div className="mb-6">
              <Alert variant="error" message={state.message} />
            </div>
          )}

          <form className="flex flex-col gap-5" action={action}>
            <Input
              id="email"
              name="email"
              type="email"
              label="Correo electrónico"
              placeholder="ejemplo@correo.com"
              leftIcon={<Mail className="w-4 h-4" />}
              error={state?.errors?.email ?? emailError ?? undefined}
              message="Ingresa un correo electrónico."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => touch("email")}
              validation={getValidation(touched.email, emailError, email, true)}
            />

            <PasswordInput
              id="contraseña"
              name="contraseña"
              label="Contraseña"
              error={state?.errors?.password ?? passwordError ?? undefined}
              message="Ingresa una contraseña."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => touch("password")}
              validation={getValidation(touched.password, passwordError, password, true)}
            />

            <Button type="submit" isLoading={isLoading} size="lg">
              Iniciar sesión
            </Button>

            <div className="flex items-center justify-center">
              <Link
                href="/recuperar"
                className="text-sm text-secondary hover:text-white transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </form>
        </Card>

        <p className="text-center text-xs text-muted mt-6 select-none">
          &copy; 2026 Playr es una organización privada con todos los derechos reservados.
        </p>
      </div>
    </main>
  )
}
