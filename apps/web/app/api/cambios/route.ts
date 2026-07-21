import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { estadoControlCambios, fijarPasswordCambios } from '@/lib/server/cambios'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/cambios → estado del control de cambios para el usuario en sesión.
// No revela la contraseña ni su hash: solo si hay candado, si a mí me aplica y
// hasta cuándo estoy desbloqueado.
export async function GET() {
  const g = await exigir()
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await estadoControlCambios())
  } catch (e) {
    return respuestaError(e)
  }
}

// PUT /api/cambios → el Dueño fija, cambia o quita la contraseña.
// Body: { password: string } para fijar/cambiar · { password: null } para quitar.
export async function PUT(req: Request) {
  // Solo el Dueño: es su llave, y `administracion.aprobar` es exclusivo suyo.
  const g = await exigir('administracion', 'aprobar')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  if (!g.usuario.tenantId) {
    return NextResponse.json({ error: 'Usuario sin organización' }, { status: 400 })
  }
  try {
    const body = (await req.json().catch(() => ({}))) as { password?: unknown }
    const plano =
      body.password === null ? null : typeof body.password === 'string' ? body.password : undefined
    if (plano === undefined) {
      return NextResponse.json({ error: 'Falta la contraseña' }, { status: 400 })
    }
    const r = await fijarPasswordCambios(g.usuario.tenantId, plano)
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: 400 })
    await registrarAccion(
      g.usuario,
      r.activo ? 'Activó el control de cambios' : 'Desactivó el control de cambios',
      r.activo ? 'Los demás roles necesitarán contraseña para cambios sensibles' : 'Todos los roles vuelven a cambiar sin contraseña',
    )
    return NextResponse.json({ ok: true, activo: r.activo })
  } catch (e) {
    return respuestaError(e)
  }
}
