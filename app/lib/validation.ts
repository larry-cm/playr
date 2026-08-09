import { getCountryByCode } from "@lib/countries"

export function validateEmail(value: string): string | null {
  if (!value) return "Ingresa un correo electrónico."
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Ingresa un correo electrónico válido."
  return null
}

export function validatePassword(value: string): string | null {
  if (!value) return "Ingresa una contraseña."
  if (value.length < 6) return "La contraseña debe tener al menos 6 caracteres."
  if (value.length > 20) return "La contraseña no puede superar los 20 caracteres."
  if (!/(?=.*[a-z])/.test(value)) return "Incluye al menos una letra minúscula."
  if (!/(?=.*[A-Z])/.test(value)) return "Incluye al menos una letra mayúscula."
  if (!/(?=.*[@$!%*?&])/.test(value)) return "Incluye al menos un carácter especial (@$!%*?&)."
  return null
}

export function validatePasswordSimple(value: string): string | null {
  if (!value) return "Ingresa una contraseña."
  if (value.length < 6) return "La contraseña debe tener al menos 6 caracteres."
  return null
}

export function validateUsername(value: string): string | null {
  if (!value) return "Ingresa un nombre de usuario."
  if (value.length < 3) return "Mínimo 3 caracteres."
  if (value.length > 10) return "Máximo 10 caracteres."
  if (!/^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+$/.test(value)) return "Solo letras, sin espacios ni números."
  return null
}

export function validatePhone(code: string, number: string): string | null {
  if (!number) return null
  const country = getCountryByCode(code)
  if (!country) return "Código de país no válido."
  const digits = number.replace(/\D/g, "")
  if (digits.length < country.minDigits || digits.length > country.maxDigits) {
    return `El número debe tener entre ${country.minDigits} y ${country.maxDigits} dígitos para ${country.country}.`
  }
  return null
}

export function validateConfirmPassword(password: string, confirm: string): string | null {
  if (!confirm) return "Confirma tu nueva contraseña."
  if (password !== confirm) return "Las contraseñas no coinciden."
  return null
}
