import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { usuarioActual, SESSION_COOKIE } from '@/lib/server/auth'
import { actualizarPerfilCtrl } from '@/lib/server/perfil-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/perfil → el usuario en sesión cambia su propio correo y/o contraseña.
//
// Resuelve con `usuarioActual()` y NO con `exigir()`, a propósito: es LA salida
// del estado de contraseña temporal (ADR 0009). `exigir()` cierra todas las
// demás rutas mientras `debeCambiarPassword` esté puesto; si ésta también
// pasara por ahí, no habría manera de cambiarla nunca.
export async function PATCH(req: Request) {
  const u = await usuarioActual()
  if (!u) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  try {
    // El token de ESTA sesión, para que el cambio cierre las demás y no ésta.
    const tokenSesion = cookies().get(SESSION_COOKIE)?.value ?? null
    const res = await actualizarPerfilCtrl({ ...u, tokenSesion }, await req.json().catch(() => ({})))
    await registrarAccion(u, 'Actualizó su cuenta', u.nombre)
    return NextResponse.json(res)
  } catch (e) {
    return respuestaError(e)
  }
}
