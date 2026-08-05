import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { estadoControlCambios, fijarExigirReautenticacion } from '@/lib/server/cambios'
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

// PUT /api/cambios → el Dueño enciende o apaga la exigencia de reautenticación.
// Body: { activo: boolean }.
//
// Ya NO recibe ninguna contraseña (ADR 0009): no hay secreto de tenant que
// fijar. Cada quien se reautentica con la suya, así que esto es un interruptor.
export async function PUT(req: Request) {
  // Solo el Dueño: `administracion.aprobar` es exclusivo suyo.
  const g = await exigir('administracion', 'aprobar')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  if (!g.usuario.tenantId) {
    return NextResponse.json({ error: 'Usuario sin organización' }, { status: 400 })
  }
  try {
    const body = (await req.json().catch(() => ({}))) as { activo?: unknown }
    if (typeof body.activo !== 'boolean') {
      return NextResponse.json({ error: 'Falta `activo` (booleano)' }, { status: 400 })
    }
    const r = await fijarExigirReautenticacion(g.usuario.tenantId, body.activo)
    await registrarAccion(
      g.usuario,
      r.activo ? 'Activó el control de cambios' : 'Desactivó el control de cambios',
      r.activo
        ? 'Los cambios sensibles exigirán que cada quien reintroduzca su propia contraseña'
        : 'Los cambios sensibles dejan de pedir contraseña',
    )
    return NextResponse.json({ ok: true, activo: r.activo })
  } catch (e) {
    return respuestaError(e)
  }
}
