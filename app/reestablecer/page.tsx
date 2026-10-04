"use client"
import { type FormEvent, useEffect, useState } from "react"
import { supabase } from "@lib/supabase/client"
import Card from "@ui/card"
import PlayrLogo from "@ui/playr-logo"
import Alert from "@ui/alert"
import PasswordInput from "@ui/password-input"
import type { ValidationState } from "@ui/input"
import Button from "@ui/button"
import Link from "next/link"
import { ArrowLeft, LogIn } from "lucide-react"
import { translateAuthError } from "@lib/supabase/auth-errors"
import { validatePassword, validateConfirmPassword } from "@lib/validation"

type Status = "verificando" | "listo" | "invalido" | "exito"

// Mismo aspecto que <Button size="lg"> primario, pero como enlace: un botón dentro
// de un <a> anida dos elementos interactivos.
const primaryLinkClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 px-5 text-sm font-medium text-white bg-gradient-to-r from-accent to-[#7c3aed] hover:from-accent-hover hover:to-accent hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"

function getValidation(touched: boolean, error: string | null): ValidationState {
  if (!touched) return "idle"
  return error ? "invalid" : "valid"
}

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>("verificando")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [touched, setTouched] = useState({ password: false, confirmPassword: false })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Solo se permite cambiar la contraseña dentro de una sesión de recuperación:
  // una sesión normal abierta en el navegador no basta. Supabase la marca con el
  // evento PASSWORD_RECOVERY al canjear el enlace del correo.
  useEffect(() => {
    let cancelled = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setStatus((s) => (s === "exito" ? s : "listo"))
    })

    const decide = async () => {
      // El cliente canjea solo el enlace (?code= o #access_token) al iniciar; esperar a que termine.
      await supabase.auth.getSession()
      const code = new URLSearchParams(window.location.search).get("code")
      // Si el canje automático no ocurrió, se intenta aquí; si ya ocurrió, falla sin tocar la sesión.
      if (code) await supabase.auth.exchangeCodeForSession(code)
      // El aviso PASSWORD_RECOVERY del canje automático se emite en un setTimeout posterior.
      await new Promise((resolve) => setTimeout(resolve, 150))
      if (!cancelled) setStatus((s) => (s === "verificando" ? "invalido" : s))
    }
    decide()

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const passwordError = validatePassword(password)
  const confirmPasswordError = validateConfirmPassword(password, confirmPassword)
  const passwordShown = touched.password ? passwordError : null
  const confirmShown = touched.confirmPassword ? confirmPasswordError : null

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitError(null)
    if (passwordError || confirmPasswordError) {
      setTouched({ password: true, confirmPassword: true })
      document.getElementById(passwordError ? "new-password" : "confirm-password")?.focus()
      return
    }
    setIsSubmitting(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setSubmitError(translateAuthError(error.message))
        return
      }
      // La sesión de recuperación no es la de ninguna pestaña: se cierra y se entra por el login.
      await supabase.auth.signOut({ scope: "local" })
      setStatus("exito")
    } catch {
      setSubmitError("No se pudo conectar. Intenta de nuevo.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // El aviso de error del envío recibe el foco para que se lea.
  useEffect(() => {
    if (submitError) document.getElementById("reset-error")?.focus()
  }, [submitError])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md animate-[fadeIn_0.6s_ease-out] motion-reduce:animate-none">
        <Card padding="p-8">
          {status === "verificando" && (
            <div className="flex flex-col items-center py-8" role="status">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-secondary text-sm mt-4">Verificando enlace...</p>
            </div>
          )}

          {status === "invalido" && (
            <>
              <div className="flex flex-col items-center mb-8">
                <PlayrLogo />
                <h1 className="text-2xl font-bold text-white tracking-tight mt-5">
                  Enlace inválido o vencido
                </h1>
                <p className="text-secondary text-sm mt-1.5 text-center leading-relaxed">
                  Este enlace de recuperación ya se usó, venció o no es válido.
                </p>
              </div>

              <div className="mb-6">
                <Alert variant="error" message="Solicita un nuevo enlace de recuperación." />
              </div>

              <div className="flex flex-col gap-3">
                <Link href="/recuperar" className={primaryLinkClass}>
                  Solicitar nuevo enlace
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-1.5 text-sm text-secondary hover:text-white transition-colors rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver a inicio de sesión
                </Link>
              </div>
            </>
          )}

          {(status === "listo" || status === "exito") && (
            <>
              <div className="flex flex-col items-center mb-8">
                <PlayrLogo />
                <h1 className="text-2xl font-bold text-white tracking-tight mt-5">
                  Establecer nueva contraseña
                </h1>
                <p className="text-secondary text-sm mt-1.5 text-center leading-relaxed">
                  Ingresa tu nueva contraseña para acceder a tu cuenta.
                </p>
              </div>

              {status === "exito" ? (
                <>
                  <div className="mb-6">
                    <Alert variant="success" message="Tu contraseña se ha restablecido correctamente." />
                  </div>
                  <Link href="/" className={primaryLinkClass}>
                    <LogIn className="w-4 h-4" />
                    Iniciar sesión
                  </Link>
                </>
              ) : (
                <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
                  {submitError && (
                    <div id="reset-error" tabIndex={-1} className="mb-2 outline-none">
                      <Alert variant="error" message={submitError} />
                    </div>
                  )}

                  <PasswordInput
                    id="new-password"
                    name="new-password"
                    autoComplete="new-password"
                    label="Nueva contraseña"
                    error={passwordShown ?? undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => password && setTouched((p) => ({ ...p, password: true }))}
                    validation={getValidation(touched.password, passwordShown)}
                  />

                  <PasswordInput
                    id="confirm-password"
                    name="confirm-password"
                    autoComplete="new-password"
                    label="Confirmar contraseña"
                    error={confirmShown ?? undefined}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onBlur={() => confirmPassword && setTouched((p) => ({ ...p, confirmPassword: true }))}
                    validation={getValidation(touched.confirmPassword, confirmShown)}
                  />

                  <Button type="submit" isLoading={isSubmitting} size="lg">
                    Restablecer contraseña
                  </Button>
                </form>
              )}
            </>
          )}
        </Card>
      </div>
    </main>
  )
}
