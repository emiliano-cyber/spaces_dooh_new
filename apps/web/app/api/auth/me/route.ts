import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { usuarioActual, permisosDeRol, CSRF_COOKIE, cookieCsrf, nuevoCsrfToken, debeGuardarCodigos } from '@/lib/server/auth'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/auth/me → { usuario, permisos } o 401 si no hay sesión.
//
// Resuelve con `usuarioActual()` y NO con `exigir()`, a propósito: es una de
// las dos rutas que tienen que seguir funcionando con una contraseña temporal
// (ADR 0009). `exigir()` corta todo mientras `debeCambiarPassword` esté puesto;
// si esta ruta pasara por ahí, el usuario no podría ni resolver su sesión y
// quedaría encerrado sin forma de cambiarla. La otra es PATCH /api/perfil.
//
// Con la base caída y una cookie de sesión presente, `usuarioActual()` lanza y
// sin el try Next contestaba un 500 con el cuerpo vacío (2026-09-30). Ahora es
// un 503 legible. Sin cookie no se toca la base y sigue siendo 401.
export async function GET() {
  try {
    return await resolverSesion()
  } catch (e) {
    return respuestaError(e)
  }
}

async function resolverSesion(): Promise<NextResponse> {
  const u = await usuarioActual()
  if (!u) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })
  const permisos = await permisosDeRol(u.rol)
  // `debeGuardarCodigos` va DERIVADO y no se deja calcular a la interfaz: la
  // regla es la misma que usa `exigir()` para cortar, y con dos copias el
  // servidor cortaria por una razon y la interfaz llevaria a otra parte.
  const res = NextResponse.json({
    usuario: { ...u, debeGuardarCodigos: debeGuardarCodigos(u) },
    permisos,
  })
  // Se llama al montar la app: aprovecha para garantizar que exista la cookie
  // CSRF. Así las sesiones abiertas ANTES de este cambio obtienen su token sin
  // tener que volver a iniciar sesión.
  if (!cookies().get(CSRF_COOKIE)?.value) {
    res.cookies.set(cookieCsrf(nuevoCsrfToken()))
  }
  return res
}
