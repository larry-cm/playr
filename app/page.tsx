"use client";
import Card from "@ui/card";
import { loginAction } from "@action/login-action";
import { useActionState } from "react";
import type { LoginState } from "@action/login-action";
const initialState: LoginState = { success: false, errors: {} };
export default function Home() {
  const [state, action, isLoading] = useActionState(loginAction, initialState);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      {state && state.success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">¡Éxito!</strong>
          <span className="block sm:inline"> Has iniciado sesión correctamente.</span>
        </div>
      )}

      {state && state.message && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <span className="block sm:inline">{state.message}</span>
        </div>
      )}

      <article className="flex flex-col gap-4 w-full max-w-md">
        <Card>
          <h1 className="text-2xl font-bold text-center mb-4">Inicio de sesión</h1>
          <p>¡Bienvenido de vuelta! Por favor, ingresa tus credenciales para acceder a tu cuenta.</p>

          <form className="flex flex-col gap-4 mt-4" action={action}>
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="font-semibold block w-fit">Correo electrónico</label>
              <input type="email" id="email" name="email" placeholder="Ingresa tu correo electrónico" className="border border-gray-300 rounded-md p-2" />
              <div>
                {
                  state && state.errors && state.errors.email &&
                  state.errors.email.map((error, index) => (
                    <p key={index} className="text-red-500 text-sm">{error}</p>
                  ))
                }
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="contraseña" className="font-semibold block w-fit">Contraseña</label>
              <input type="password" id="contraseña" name="contraseña" placeholder="Ingresa tu contraseña" className="border border-gray-300 rounded-md p-2" />

              <div>
                {
                  state && state.errors && state.errors.password &&
                  state.errors.password.map((error, index) => (
                    <p key={index} className="text-red-500 text-sm">{error}</p>
                  ))
                }
              </div>

            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="recordar" name="recordar" className="w-4 h-4" />
              <label htmlFor="recordar" className="font-semibold">Recordarme</label>
            </div>

            <button type="submit" className="bg-blue-500 text-white rounded-md p-2 mt-4 hover:bg-blue-600 transition-colors">
              {isLoading ? "Cargando..." : "Iniciar sesión"}
            </button>
          </form>
        </Card>
      </article>


    </main>
  );
}
