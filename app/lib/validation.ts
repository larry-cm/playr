import { getCountryByCode } from "@lib/countries"
import { splitPhoneNumber } from "@lib/phone"

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

// Nombre de persona: letras con espacios simples entre palabras, sin números ni símbolos.
export function validateUsername(value: string): string | null {
  if (!value) return "Ingresa un nombre de usuario."
  if (value.length < 3) return "Mínimo 3 caracteres."
  if (value.length > 60) return "Máximo 60 caracteres."
  if (!/^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+(?: [a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+)*$/.test(value)) {
    return "Solo letras y espacios, sin números ni símbolos."
  }
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

// Un teléfono escrito a mano admite espacios, paréntesis o guiones, pero nunca letras.
const phoneCharacters = /^[+\d\s()-]+$/

/**
 * Valida un teléfono guardado como un único texto ("+57 300 123 4567").
 * `validatePhone` solo cuenta dígitos, de modo que un texto sin ningún número
 * ("asdasd") le resultaría válido por tratarse como vacío; aquí se rechaza antes
 * de contar. Sigue siendo opcional cuando no hay nada escrito.
 */
export function validatePhoneValue(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const invalid = "El teléfono solo admite números."
  if (!phoneCharacters.test(trimmed)) return invalid

  const { code, number } = splitPhoneNumber(trimmed)
  if (!number) return invalid

  return validatePhone(code, number)
}

export function validateConfirmPassword(password: string, confirm: string): string | null {
  if (!confirm) return "Confirma tu nueva contraseña."
  if (password !== confirm) return "Las contraseñas no coinciden."
  return null
}
