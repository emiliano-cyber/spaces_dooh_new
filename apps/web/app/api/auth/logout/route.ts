import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, CSRF_COOKIE, destruirSesion } from '@/lib/server/auth'
import { respuestaError } from '@/lib/server/errores'
import { cookieIdiomaCuentaBorrada } from '@/lib/server/idioma-cuenta'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/auth/logout → borra la sesión y limpia la cookie.
//
// Con la base caída `destruirSesion` lanza, y sin el try Next contestaba un 500
// con el cuerpo vacío (2026-09-30). Ahora es un 503 legible. Las cookies NO se
// limpian en ese caso, a propósito: la sesión sigue viva en la base, y decirle
// al navegador que salió cuando el servidor no la ha cerrado sería mentirle.
export async function POST() {
  try {
    const token = cookies().get(SESSION_COOKIE)?.value
    if (token) await destruirSesion(token)
  } catch (e) {
    return respuestaError(e)
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set({ name: SESSION_COOKIE, value: '', maxAge: 0, path: '/' })
  res.cookies.set({ name: CSRF_COOKIE, value: '', maxAge: 0, path: '/' })
  // La preferencia de idioma de la cuenta (IDIOMA-USUARIO, 03/11). Atada a la
  // sesión ya no casaría con nada, pero se borra igual: lo que se queda en el
  // navegador es la elección DEL NAVEGADOR (`spaces_idioma`), no la de la cuenta.
  res.cookies.set(cookieIdiomaCuentaBorrada())
  return res
}
