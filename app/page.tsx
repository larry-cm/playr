"use client";
import Card from "@ui/card";
import PlayrLogo from "@ui/playr-logo";
import Alert from "@ui/alert";
import Input from "@ui/input";
import type { ValidationState } from "@ui/input";
import PasswordInput from "@ui/password-input";
import Checkbox from "@ui/checkbox";
import Button from "@ui/button";
import { loginAction } from "@action/login-action";
import { useActionState, useState } from "react";
import type { LoginState } from "@action/login-action";
import { Mail } from "lucide-react";
import Link from "next/link";
import { validateEmail } from "@lib/validation";

const initialState: LoginState = { success: false, errors: {} };

function getValidation(
  touched: boolean,
  error: string | null,
  value: string,
  required: boolean,
): ValidationState {
  if (!touched) return "idle";
  if (error) return "invalid";
  if (required && !value) return "invalid";
  return "valid";
}

export default function Home() {
  const [state, action, isLoading] = useActionState(loginAction, initialState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ email: false, password: false });

  const touch = (field: "email" | "password") => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const emailError = validateEmail(email);
  const passwordError = !password ? "Ingresa una contraseña." : null;

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
              error={state?.errors?.email ?? (touched.email ? emailError ?? undefined : undefined)}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => touch("email")}
              validation={getValidation(touched.email, emailError, email, true)}
            />

            <PasswordInput
              id="contraseña"
              name="contraseña"
              label="Contraseña"
              error={state?.errors?.password ?? (touched.password ? passwordError ?? undefined : undefined)}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => touch("password")}
              validation={getValidation(touched.password, passwordError, password, true)}
            />

            <div className="flex items-center justify-between">
              <Checkbox id="recordar" name="recordar" label="Recordarme" />
              <Link
                href="/recuperar"
                className="text-sm text-secondary hover:text-white transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <Button type="submit" isLoading={isLoading} size="lg">
              Iniciar sesión
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-muted mt-6 select-none">
          &copy; 2026 Playr. Todos los derechos reservados.
        </p>
      </div>
    </main>
  );
}
