// Validación de correo compartida (cliente + servidor). Estructura básica
// usuario@dominio.tld (p. ej. ejemplo@correo.com): un @, sin espacios, y un
// dominio con punto. Así no se permiten "cosas raras" (sin @, sin dominio, etc.).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function esEmailValido(email: unknown): boolean {
  return typeof email === 'string' && EMAIL_RE.test(email.trim())
}

export const EMAIL_INVALIDO = 'Correo inválido. Usa el formato ejemplo@correo.com'
