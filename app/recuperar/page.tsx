"use client"
import Card from "@ui/card"
import PlayrLogo from "@ui/playr-logo"
import Alert from "@ui/alert"
import Input from "@ui/input"
import type { ValidationState } from "@ui/input"
import Button from "@ui/button"
import { useActionState, useState } from "react"
import { type ForgotPasswordState, forgotPasswordAction } from "@action/login/forgot-password-action"
import { Mail, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { validateEmail } from "@lib/validation"

const initialState: ForgotPasswordState = { success: false, errors: {} }

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

export default function ForgotPasswordPage() {
  const [state, action, isLoading] = useActionState(forgotPasswordAction, initialState)
  const [email, setEmail] = useState("")
  const [touched, setTouched] = useState(false)

  const emailError = validateEmail(email)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md animate-[fadeIn_0.6s_ease-out]">
        <Card>
          <div className="flex flex-col items-center mb-8">
            <PlayrLogo />
            <h1 className="text-2xl font-bold text-white tracking-tight mt-5">
              Recuperar contraseña
            </h1>
            <p className="text-secondary text-sm mt-1.5 text-center leading-relaxed">
              Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
            </p>
          </div>

          {state?.success && (
            <div className="mb-6">
              <Alert variant="success" message={state.message!} />
            </div>
          )}

          {state?.message && !state.success && (
            <div className="mb-6">
              <Alert variant="error" message={state.message} />
            </div>
          )}

          {!state?.success && (
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
                onBlur={() => setTouched(true)}
                validation={getValidation(touched, emailError, email, true)}
              />

              <Button type="submit" isLoading={isLoading} size="lg">
                Enviar enlace de recuperación
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver a inicio de sesión
            </Link>
          </div>
        </Card>

        <p className="text-center text-xs text-muted mt-6 select-none">
          &copy; 2026 Playr. Todos los derechos reservados.
        </p>
      </div>
    </main>
  )
}
