import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { usuarioActual, permisosDeRol, CSRF_COOKIE, cookieCsrf, nuevoCsrfToken } from '@/lib/server/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/auth/me → { usuario, permisos } o 401 si no hay sesión.
//
// Resuelve con `usuarioActual()` y NO con `exigir()`, a propósito: es una de
// las dos rutas que tienen que seguir funcionando con una contraseña temporal
// (ADR 0009). `exigir()` corta todo mientras `debeCambiarPassword` esté puesto;
// si esta ruta pasara por ahí, el usuario no podría ni resolver su sesión y
// quedaría encerrado sin forma de cambiarla. La otra es PATCH /api/perfil.
export async function GET() {
  const u = await usuarioActual()
  if (!u) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })
  const permisos = await permisosDeRol(u.rol)
  const res = NextResponse.json({ usuario: u, permisos })
  // Se llama al montar la app: aprovecha para garantizar que exista la cookie
  // CSRF. Así las sesiones abiertas ANTES de este cambio obtienen su token sin
  // tener que volver a iniciar sesión.
  if (!cookies().get(CSRF_COOKIE)?.value) {
    res.cookies.set(cookieCsrf(nuevoCsrfToken()))
  }
  return res
}
