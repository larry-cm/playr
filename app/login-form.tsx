"use client"

import { Mail } from "lucide-react"
import { type LoginState, loginAction } from "@action/login/login-action"
import { unstable_rethrow } from "next/navigation"
import { type FormEvent, useActionState, useEffect, useRef, useState } from "react"
import { validateEmail } from "@lib/validation"
import Alert from "@ui/alert"
import Button from "@ui/button"
import Card from "@ui/card"
import Input, { type ValidationState } from "@ui/input"
import Link from "next/link"
import PasswordInput from "@ui/password-input"
import PlayrLogo from "@ui/playr-logo"

type Field = "email" | "password"

const initialState: LoginState = { success: false, errors: {} }

// Si la petición ni siquiera llega (sin red, servidor caído) la acción lanza en
// vez de devolver un estado. El redirect de un login correcto también llega como
// excepción: unstable_rethrow lo deja pasar para que Next navegue.
async function submitLogin(prev: LoginState, formData: FormData): Promise<LoginState> {
  try {
    return await loginAction(prev, formData)
  } catch (error) {
    unstable_rethrow(error)
    return { success: false, errors: {}, message: "No se pudo conectar. Intenta de nuevo." }
  }
}

function getValidation(touched: boolean, error: string | undefined): ValidationState {
  if (error) return "invalid"
  return touched ? "valid" : "idle"
}

export default function LoginForm() {
  const [state, action, isLoading] = useActionState(submitLogin, initialState)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  // Un campo se valida en vivo cuando ya se escribió en él y se salió, o tras intentar enviar.
  const [touched, setTouched] = useState({ email: false, password: false })
  // El error que devolvió el servidor para un campo deja de valer en cuanto se edita ese campo.
  const [edited, setEdited] = useState({ email: false, password: false })
  const [prevState, setPrevState] = useState(state)
  const alertRef = useRef<HTMLDivElement>(null)

  if (state !== prevState) {
    setPrevState(state)
    setEdited({ email: false, password: false })
  }

  const emailError = validateEmail(email.trim())
  const passwordError = !password ? "Ingresa una contraseña." : null

  const fieldError = (field: Field, clientError: string | null) =>
    (touched[field] ? clientError : null) ?? (edited[field] ? undefined : state.errors?.[field]?.[0])

  const emailShown = fieldError("email", emailError)
  const passwordShown = fieldError("password", passwordError)

  const focusField = (field: Field) => document.getElementById(field)?.focus()

  // Tras una respuesta fallida, el foco va al primer campo con error o, si no, al aviso.
  useEffect(() => {
    if (state.errors?.email) focusField("email")
    else if (state.errors?.password) focusField("password")
    else if (state.message) alertRef.current?.focus()
  }, [state])

  const change = (field: Field, value: string) => {
    if (field === "email") setEmail(value)
    else setPassword(value)
    setEdited((prev) => ({ ...prev, [field]: true }))
  }

  const blur = (field: Field, value: string) => {
    if (value) setTouched((prev) => ({ ...prev, [field]: true }))
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (!emailError && !passwordError) return
    e.preventDefault()
    setTouched({ email: true, password: true })
    focusField(emailError ? "email" : "password")
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md animate-[fadeIn_0.6s_ease-out] motion-reduce:animate-none">
        <Card padding="p-8">
          <div className="flex flex-col items-center mb-8">
            <PlayrLogo />
            <h1 className="text-2xl font-bold text-white tracking-tight mt-5">
              Inicio de sesión
            </h1>
            <p className="text-secondary text-sm mt-1.5 text-center leading-relaxed">
              Ingresa tus credenciales para acceder a tu cuenta
            </p>
          </div>

          {state.message && (
            <div ref={alertRef} tabIndex={-1} className="mb-6 outline-none">
              <Alert variant="error" message={state.message} />
            </div>
          )}

          <form className="flex flex-col gap-5" action={action} onSubmit={handleSubmit} noValidate>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              label="Correo electrónico"
              placeholder="ejemplo@correo.com"
              leftIcon={<Mail className="w-4 h-4" />}
              error={emailShown}
              value={email}
              onChange={(e) => change("email", e.target.value)}
              onBlur={() => blur("email", email)}
              validation={getValidation(touched.email, emailShown)}
            />

            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              label="Contraseña"
              error={passwordShown}
              value={password}
              onChange={(e) => change("password", e.target.value)}
              onBlur={() => blur("password", password)}
              validation={getValidation(touched.password, passwordShown)}
            />

            <Button type="submit" isLoading={isLoading} size="lg">
              Iniciar sesión
            </Button>

            <div className="flex items-center justify-center">
              <Link
                href="/recuperar"
                className="text-sm text-secondary hover:text-white transition-colors rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
