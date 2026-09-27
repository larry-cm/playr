"use client"
import Card from "@ui/card"
import PlayrLogo from "@ui/playr-logo"
import Alert from "@ui/alert"
import Input from "@ui/input"
import type { ValidationState } from "@ui/input"
import Button from "@ui/button"
import { type FormEvent, useActionState, useEffect, useRef, useState } from "react"
import { type ForgotPasswordState, forgotPasswordAction } from "@action/login/forgot-password-action"
import { Mail, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { unstable_rethrow } from "next/navigation"
import { validateEmail } from "@lib/validation"

const initialState: ForgotPasswordState = { success: false, errors: {} }

// Si la petición no llega al servidor la acción lanza en vez de devolver un estado.
async function submitForgot(prev: ForgotPasswordState, formData: FormData): Promise<ForgotPasswordState> {
  try {
    return await forgotPasswordAction(prev, formData)
  } catch (error) {
    unstable_rethrow(error)
    return { success: false, errors: {}, message: "No se pudo conectar. Intenta de nuevo." }
  }
}

function getValidation(touched: boolean, error: string | undefined): ValidationState {
  if (error) return "invalid"
  return touched ? "valid" : "idle"
}

export default function ForgotPasswordPage() {
  const [state, action, isLoading] = useActionState(submitForgot, initialState)
  const [email, setEmail] = useState("")
  // Se valida en vivo cuando ya se escribió y se salió del campo, o tras intentar enviar.
  const [touched, setTouched] = useState(false)
  // El error del servidor para el correo deja de valer en cuanto se edita el campo.
  const [edited, setEdited] = useState(false)
  const [prevState, setPrevState] = useState(state)
  const alertRef = useRef<HTMLDivElement>(null)

  if (state !== prevState) {
    setPrevState(state)
    setEdited(false)
  }

  const emailError = validateEmail(email.trim())
  const emailShown = (touched ? emailError : null) ?? (edited ? undefined : state.errors?.email?.[0])

  // Tras una respuesta, el foco va al campo con error o al aviso (de error o de éxito).
  useEffect(() => {
    if (state.errors?.email) document.getElementById("email")?.focus()
    else if (state.message) alertRef.current?.focus()
  }, [state])

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (!emailError) return
    e.preventDefault()
    setTouched(true)
    document.getElementById("email")?.focus()
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md animate-[fadeIn_0.6s_ease-out] motion-reduce:animate-none">
        <Card padding="p-8">
          <div className="flex flex-col items-center mb-8">
            <PlayrLogo />
            <h1 className="text-2xl font-bold text-white tracking-tight mt-5">
              Recuperar contraseña
            </h1>
            <p className="text-secondary text-sm mt-1.5 text-center leading-relaxed">
              Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
            </p>
          </div>

          {state.message && (
            <div ref={alertRef} tabIndex={-1} className="mb-6 outline-none">
              <Alert variant={state.success ? "success" : "error"} message={state.message} />
            </div>
          )}

          {!state.success && (
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
                onChange={(e) => {
                  setEmail(e.target.value)
                  setEdited(true)
                }}
                onBlur={() => email && setTouched(true)}
                validation={getValidation(touched, emailShown)}
              />

              <Button type="submit" isLoading={isLoading} size="lg">
                Enviar enlace de recuperación
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-white transition-colors rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver a inicio de sesión
            </Link>
          </div>
        </Card>

        <p className="text-center text-xs text-muted mt-6 select-none">
          &copy; 2026 Playr es una organización privada con todos los derechos reservados.
        </p>
      </div>
    </main>
  )
}
