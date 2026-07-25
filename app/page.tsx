"use client";
import Card from "@ui/card";
import { loginAction } from "@action/login-action";
import { useActionState, useState } from "react";
import type { LoginState } from "@action/login-action";
import { Mail, Lock, Eye, EyeOff, CircleCheck, CircleAlert, TriangleAlert, LoaderCircle, Check } from "lucide-react";

const initialState: LoginState = { success: false, errors: {} };

function PlayrLogo() {
  return (
    <div className="flex items-center justify-center gap-2.5 mb-1">
      <svg width="34" height="34" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="36" height="36" rx="10" fill="url(#logo-grad)" />
        <path d="M13 10.5L24 18L13 25.5V10.5Z" fill="white" />
        <defs>
          <linearGradient id="logo-grad" x1="0" y1="0" x2="36" y2="36">
            <stop stopColor="#8b5cf6" />
            <stop offset="1" stopColor="#6366f1" />
          </linearGradient>
        </defs>
      </svg>
      <span className="text-2xl font-bold tracking-tight text-white">Playr</span>
    </div>
  );
}

export default function Home() {
  const [state, action, isLoading] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

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
            <div className="mb-6 flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-emerald-400 text-sm" role="alert">
              <CircleCheck className="w-5 h-5 shrink-0" />
              <span>Has iniciado sesión correctamente.</span>
            </div>
          )}

          {state?.message && (
            <div className="mb-6 flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm" role="alert">
              <CircleAlert className="w-5 h-5 shrink-0" />
              <span>{state.message}</span>
            </div>
          )}

          <form className="flex flex-col gap-5" action={action}>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium text-secondary">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="ejemplo@correo.com"
                  className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl py-2.5 pl-10 pr-3.5 text-sm text-white placeholder-muted outline-none transition-all duration-200 focus:border-accent focus:ring-1 focus:ring-accent/40"
                />
              </div>
              {state?.errors?.email?.map((error, i) => (
                <p key={i} className="text-red-400 text-xs flex items-center gap-1 mt-0.5">
                  <TriangleAlert className="w-3 h-3 shrink-0" />
                  {error}
                </p>
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="contraseña" className="text-sm font-medium text-secondary">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  id="contraseña"
                  name="contraseña"
                  placeholder="••••••••"
                  className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl py-2.5 pl-10 pr-10 text-sm text-white placeholder-muted outline-none transition-all duration-200 focus:border-accent focus:ring-1 focus:ring-accent/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-white/5 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4 text-muted" /> : <Eye className="w-4 h-4 text-muted" />}
                </button>
              </div>
              {state?.errors?.password?.map((error, i) => (
                <p key={i} className="text-red-400 text-xs flex items-center gap-1 mt-0.5">
                  <TriangleAlert className="w-3 h-3 shrink-0" />
                  {error}
                </p>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative">
                  <input type="checkbox" id="recordar" name="recordar" className="peer sr-only" />
                  <div className="w-4 h-4 rounded border border-white/[0.15] bg-white/[0.03] peer-checked:bg-accent peer-checked:border-accent transition-all duration-200 peer-focus-visible:ring-1 peer-focus-visible:ring-accent/40" />
                  <Check className="absolute inset-0 w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200 pointer-events-none" strokeWidth={3} />
                </div>
                <span className="text-sm text-secondary group-hover:text-white transition-colors">Recordarme</span>
              </label>
              <button type="button" className="text-sm text-accent hover:text-accent-hover transition-colors">
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="relative w-full flex items-center justify-center gap-2 bg-gradient-to-r from-accent to-[#7c3aed] text-white font-medium rounded-xl py-2.5 mt-1 transition-all duration-200 hover:from-accent-hover hover:to-accent hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100"
            >
              {isLoading ? (
                <>
                  <LoaderCircle className="animate-spin w-5 h-5" />
                  <span>Iniciando sesión...</span>
                </>
              ) : (
                "Iniciar sesión"
              )}
            </button>
          </form>
        </Card>

        <p className="text-center text-xs text-muted mt-6 select-none">
          &copy; 2026 Playr. Todos los derechos reservados.
        </p>
      </div>
    </main>
  );
}