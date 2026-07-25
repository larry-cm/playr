const errorMap: Record<string, string> = {
    "New password should be different from the old password.":
        "La nueva contraseña debe ser diferente a la anterior.",
    "Auth session missing!":
        "Sesión no válida. Solicita un nuevo enlace de recuperación.",
    "Invalid login credentials":
        "Credenciales inválidas. Verifica tu correo y contraseña.",
    "Email not confirmed":
        "Correo electrónico no confirmado. Revisa tu bandeja de entrada.",
    "Email address not authorized":
        "Correo electrónico no autorizado.",
    "Failed to send email":
        "No se pudo enviar el correo. Intenta de nuevo más tarde.",
    "Unable to update the user":
        "No se pudo actualizar la contraseña. Intenta de nuevo.",
}

export function translateAuthError(message: string): string {
    return errorMap[message] ?? message
}
