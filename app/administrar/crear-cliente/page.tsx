"use client";
import Card from "@ui/card";
import PlayrLogo from "@ui/playr-logo";
import Alert from "@ui/alert";
import Input from "@ui/input";
import type { ValidationState } from "@ui/input";
import PasswordInput from "@ui/password-input";
import SelectDropdown from "@ui/select-dropdown";
import PhoneInput from "@ui/phone-input";
import Button from "@ui/button";
import { createClientAction } from "@action/create-client-action";
import { useActionState, useState, useEffect, useCallback } from "react";
import type { CreateClientState } from "@action/create-client-action";
import { Mail, User } from "lucide-react";
import {
  validateEmail,
  validatePasswordSimple,
  validateUsername,
  validatePhone,
} from "@lib/validation";

const initialState: CreateClientState = { success: false, errors: {} };

const roleOptions = [
  { value: "user", label: "Usuario" },
  { value: "admin", label: "Administrador" },
  { value: "manager", label: "Manager" },
];

interface FormFields {
  email: string;
  password: string;
  username: string;
  rol: string;
  celularCodigo: string;
  celularNumero: string;
}

const cleanForm: FormFields = {
  email: "",
  password: "",
  username: "",
  rol: "user",
  celularCodigo: "+57",
  celularNumero: "",
};

type Touched = Record<keyof FormFields, boolean>;

const cleanTouched: Touched = {
  email: false,
  password: false,
  username: false,
  rol: false,
  celularCodigo: false,
  celularNumero: false,
};

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

export default function CrearClientePage() {
  const [state, action, isLoading] = useActionState(createClientAction, initialState);
  const [form, setForm] = useState<FormFields>(cleanForm);
  const [touched, setTouched] = useState<Touched>(cleanTouched);

  useEffect(() => {
    if (state.success) {
      setTimeout(() => {
        setForm(cleanForm);
        setTouched(cleanTouched);
      });
    }
  }, [state.success]);

  const touch = (field: keyof FormFields) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  useEffect(() => {
    if (state.errors) {
      const errorFields: Record<string, keyof FormFields> = {
        email: "email",
        password: "password",
        username: "username",
        rol: "rol",
        celular_codigo: "celularCodigo",
        celular_numero: "celularNumero",
      };
      setTouched((prev) => {
        const next = { ...prev };
        for (const [serverKey, formKey] of Object.entries(errorFields)) {
          if (state.errors?.[serverKey]) {
            next[formKey] = true;
          }
        }
        return next;
      });
    }
  }, [state.errors]);

  const setInput = useCallback(
    (field: keyof FormFields) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    },
    [],
  );

  const setValue = useCallback(
    (field: keyof FormFields) => (value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const emailError = validateEmail(form.email);
  const passwordError = validatePasswordSimple(form.password);
  const usernameError = validateUsername(form.username);
  const phoneError = validatePhone(form.celularCodigo, form.celularNumero);

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-2xl animate-[fadeIn_0.6s_ease-out]">
        <Card>
          <div className="flex flex-col items-center mb-8">
            <PlayrLogo />
            <h1 className="text-2xl font-bold text-white tracking-tight mt-5">
              Crear Cliente
            </h1>
            <p className="text-secondary text-sm mt-1.5 text-center leading-relaxed">
              Registra un nuevo cliente en la plataforma
            </p>
          </div>

          {state?.success && (
            <div className="mb-6">
              <Alert variant="success" message={state.message ?? "Cliente creado correctamente."} />
            </div>
          )}

          {state?.message && !state?.success && (
            <div className="mb-6">
              <Alert variant="error" message={state.message} />
            </div>
          )}

          <form className="flex flex-col gap-5" action={action}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Input
                id="email"
                name="email"
                type="email"
                label="Correo electrónico"
                placeholder="ejemplo@correo.com"
                leftIcon={<Mail className="w-4 h-4" />}
                error={state?.errors?.email ?? (touched.email ? emailError ?? undefined : undefined)}
                value={form.email}
                onChange={setInput("email")}
                onBlur={() => touch("email")}
                validation={getValidation(touched.email, emailError, form.email, true)}
                required
              />

              <Input
                id="username"
                name="username"
                type="text"
                label="Nombre de usuario"
                placeholder="usuario"
                leftIcon={<User className="w-4 h-4" />}
                error={state?.errors?.username ?? (touched.username ? usernameError ?? undefined : undefined)}
                value={form.username}
                onChange={setInput("username")}
                onBlur={() => touch("username")}
                validation={getValidation(touched.username, usernameError, form.username, true)}
                required
              />

              <PasswordInput
                id="password"
                name="password"
                label="Contraseña"
                error={state?.errors?.password ?? (touched.password ? passwordError ?? undefined : undefined)}
                value={form.password}
                onChange={setInput("password")}
                onBlur={() => touch("password")}
                validation={getValidation(touched.password, passwordError, form.password, true)}
                required
              />

              <SelectDropdown
                options={roleOptions}
                value={form.rol}
                onChange={setValue("rol")}
                label="Rol"
                error={state?.errors?.rol}
                required
                name="rol"
                validation="valid"
              />
            </div>

            <PhoneInput
              codeValue={form.celularCodigo}
              numberValue={form.celularNumero}
              onCodeChange={(val) => {
                setValue("celularCodigo")(val);
                touch("celularCodigo");
                touch("celularNumero");
              }}
              onNumberChange={setInput("celularNumero")}
              onBlur={() => touch("celularNumero")}
              codeError={state?.errors?.celular_codigo}
              numberError={
                state?.errors?.celular_numero ??
                (touched.celularNumero ? phoneError ?? undefined : undefined)
              }
              label="Celular"
              numberPlaceholder="123 456 7890"
              validation={getValidation(touched.celularNumero, phoneError, form.celularNumero, false)}
            />

            <Button type="submit" isLoading={isLoading} size="lg">
              Crear Cliente
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
