"use client";
import { useEffect, useState } from "react";
import { supabase } from "@lib/supabase/client";
import Card from "@ui/card";
import PlayrLogo from "@ui/playr-logo";
import Alert from "@ui/alert";
import PasswordInput from "@ui/password-input";
import type { ValidationState } from "@ui/input";
import Button from "@ui/button";
import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { ArrowLeft, LogIn } from "lucide-react";
import { translateAuthError } from "@lib/supabase/auth-errors";
import { validatePassword, validateConfirmPassword } from "@lib/validation";

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

export default function ResetPasswordPage() {
  const [session, setSession] = useState<Session | null | "loading">("loading");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [touched, setTouched] = useState({ password: false, confirmPassword: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
    });
  }, []);

  const passwordError = validatePassword(password);
  const confirmPasswordError = validateConfirmPassword(password, confirmPassword);

  const validate = (): boolean => {
    const newErrors: Record<string, string[]> = {};
    if (passwordError) newErrors.password = [passwordError];
    if (confirmPasswordError) newErrors.confirmPassword = [confirmPasswordError];
    setErrors(newErrors);
    setTouched({ password: true, confirmPassword: true });
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;
    setIsSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setSubmitError(translateAuthError(error.message));
      setIsSubmitting(false);
      return;
    }
    setSuccess(true);
    setIsSubmitting(false);
  };
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md animate-[fadeIn_0.6s_ease-out]">
        <Card>
          {
            session === "loading" && (
              <div className="flex flex-col items-center py-8">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                <p className="text-secondary text-sm mt-4">Verificando enlace...</p>
              </div>
            )
          }
          {
            !session && (
              <>
                <div className="flex flex-col items-center mb-8">
                  <PlayrLogo />
                  <h1 className="text-2xl font-bold text-white tracking-tight mt-5">
                    Enlace inválido
                  </h1>
                  <p className="text-secondary text-sm mt-1.5 text-center leading-relaxed">
                    Este enlace de recuperación ha expirado o no es válido.
                  </p>
                </div>

                <div className="mb-6">
                  <Alert variant="error" message="Solicita un nuevo enlace de recuperación." />
                </div>

                <div className="flex flex-col gap-3">
                  <Link href="/recuperar">
                    <Button type="button" size="lg" className="w-full">
                      Solicitar nuevo enlace
                    </Button>
                  </Link>
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center gap-1.5 text-sm text-secondary hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Volver a inicio de sesión
                  </Link>
                </div>
              </>
            )
          }
          {
            session && (
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

                {success && (
                  <>
                    <div className="mb-6">
                      <Alert variant="success" message="Tu contraseña se ha restablecido correctamente." />
                    </div>
                    <Link href="/">
                      <Button type="button" size="lg" className="w-full" leftIcon={<LogIn className="w-4 h-4" />}>
                        Iniciar sesión
                      </Button>
                    </Link>
                  </>
                )}

                {!success && (
                  <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
                    {submitError && (
                      <div className="mb-2">
                        <Alert variant="error" message={submitError} />
                      </div>
                    )}

                    <PasswordInput
                      id="new-password"
                      name="new-password"
                      label="Nueva contraseña"
                      error={errors?.password}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onBlur={() => setTouched((p) => ({ ...p, password: true }))}
                      validation={getValidation(touched.password, passwordError, password, true)}
                    />

                    <PasswordInput
                      id="confirm-password"
                      name="confirm-password"
                      label="Confirmar contraseña"
                      error={errors?.confirmPassword}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onBlur={() => setTouched((p) => ({ ...p, confirmPassword: true }))}
                      validation={getValidation(touched.confirmPassword, confirmPasswordError, confirmPassword, true)}
                    />

                    <Button type="submit" isLoading={isSubmitting} size="lg">
                      Restablecer contraseña
                    </Button>
                  </form>
                )}
              </>
            )
          }
        </Card>
      </div>
    </main>
  )

  // if (session === "loading") {
  //   return (
  //     <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
  //       <div className="w-full max-w-md animate-[fadeIn_0.6s_ease-out]">
  //         <Card>
  //           <div className="flex flex-col items-center py-8">
  //             <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
  //             <p className="text-secondary text-sm mt-4">Verificando enlace...</p>
  //           </div>
  //         </Card>
  //       </div>
  //     </main>
  //   );
  // }

  // if (!session) {
  //   return (
  //     <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
  //       <div className="w-full max-w-md animate-[fadeIn_0.6s_ease-out]">
  //         <Card>
  //           <div className="flex flex-col items-center mb-8">
  //             <PlayrLogo />
  //             <h1 className="text-2xl font-bold text-white tracking-tight mt-5">
  //               Enlace inválido
  //             </h1>
  //             <p className="text-secondary text-sm mt-1.5 text-center leading-relaxed">
  //               Este enlace de recuperación ha expirado o no es válido.
  //             </p>
  //           </div>

  //           <div className="mb-6">
  //             <Alert variant="error" message="Solicita un nuevo enlace de recuperación." />
  //           </div>

  //           <div className="flex flex-col gap-3">
  //             <Link href="/recuperar">
  //               <Button type="button" size="lg" className="w-full">
  //                 Solicitar nuevo enlace
  //               </Button>
  //             </Link>
  //             <Link
  //               href="/"
  //               className="inline-flex items-center justify-center gap-1.5 text-sm text-secondary hover:text-white transition-colors"
  //             >
  //               <ArrowLeft className="w-4 h-4" />
  //               Volver a inicio de sesión
  //             </Link>
  //           </div>
  //         </Card>

  //         <p className="text-center text-xs text-muted mt-6 select-none">
  //           &copy; 2026 Playr. Todos los derechos reservados.
  //         </p>
  //       </div>
  //     </main>
  //   );
  // }

  // return (
  //   <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
  //     <div className="w-full max-w-md animate-[fadeIn_0.6s_ease-out]">
  //       <Card>
  //         <div className="flex flex-col items-center mb-8">
  //           <PlayrLogo />
  //           <h1 className="text-2xl font-bold text-white tracking-tight mt-5">
  //             Establecer nueva contraseña
  //           </h1>
  //           <p className="text-secondary text-sm mt-1.5 text-center leading-relaxed">
  //             Ingresa tu nueva contraseña para acceder a tu cuenta.
  //           </p>
  //         </div>

  //         {success && (
  //           <>
  //             <div className="mb-6">
  //               <Alert variant="success" message="Tu contraseña se ha restablecido correctamente." />
  //             </div>
  //             <Link href="/">
  //               <Button type="button" size="lg" className="w-full" leftIcon={<LogIn className="w-4 h-4" />}>
  //                 Iniciar sesión
  //               </Button>
  //             </Link>
  //           </>
  //         )}

  //         {!success && (
  //           <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
  //             {submitError && (
  //               <div className="mb-2">
  //                 <Alert variant="error" message={submitError} />
  //               </div>
  //             )}

  //             <PasswordInput
  //               id="new-password"
  //               name="new-password"
  //               label="Nueva contraseña"
  //               error={errors?.password}
  //               value={password}
  //               onChange={(e) => setPassword(e.target.value)}
  //             />

  //             <PasswordInput
  //               id="confirm-password"
  //               name="confirm-password"
  //               label="Confirmar contraseña"
  //               error={errors?.confirmPassword}
  //               value={confirmPassword}
  //               onChange={(e) => setConfirmPassword(e.target.value)}
  //             />

  //             <Button type="submit" isLoading={isSubmitting} size="lg">
  //               Restablecer contraseña
  //             </Button>
  //           </form>
  //         )}
  //       </Card>

  //       <p className="text-center text-xs text-muted mt-6 select-none">
  //         &copy; 2026 Playr. Todos los derechos reservados.
  //       </p>
  //     </div>
  //   </main>
  // );
}
