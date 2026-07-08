import { NextResponse } from 'next/server'
import { usuarioActual } from '@/lib/server/auth'
import { actualizarPerfilCtrl } from '@/lib/server/perfil-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/perfil → el usuario en sesión cambia su propio correo y/o contraseña.
export async function PATCH(req: Request) {
  const u = await usuarioActual()
  if (!u) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  try {
    const res = await actualizarPerfilCtrl(u, await req.json().catch(() => ({})))
    await registrarAccion(u, 'Actualizó su cuenta', u.nombre)
    return NextResponse.json(res)
  } catch (e) {
    return respuestaError(e)
  }
}
