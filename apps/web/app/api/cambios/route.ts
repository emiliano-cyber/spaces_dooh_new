import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { estadoControlCambios, fijarExigirReautenticacion, fijarContrasenaCambios } from '@/lib/server/cambios'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/cambios → estado del control de cambios para el usuario en sesión.
// No revela la contraseña ni su hash: solo si hay candado, si a mí me aplica,
// hasta cuándo estoy desbloqueado y si ya hay una contraseña compartida
// asignada (para que la UI ofrezca "asignar" o "cambiar", nunca la muestra).
export async function GET() {
  const g = await exigir()
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await estadoControlCambios())
  } catch (e) {
    return respuestaError(e)
  }
}

// PUT /api/cambios → el Dueño enciende/apaga la exigencia y/o asigna la
// contraseña compartida del candado. Body: { activo?: boolean, password?: string }.
// Los dos campos son independientes: se puede fijar una contraseña sin tocar
// el interruptor, o encenderlo sin fijar ninguna (ADR 0036 — antes de esto,
// ADR 0009, el interruptor no recibía ninguna contraseña porque no había
// ningún secreto de tenant que fijar).
export async function PUT(req: Request) {
  // Solo el Dueño: `administracion.aprobar` es exclusivo suyo.
  const g = await exigir('administracion', 'aprobar')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  if (!g.usuario.tenantId) {
    return NextResponse.json({ error: 'Usuario sin organización' }, { status: 400 })
  }
  try {
    const body = (await req.json().catch(() => ({}))) as { activo?: unknown; password?: unknown }
    if (body.activo === undefined && body.password === undefined) {
      return NextResponse.json({ error: 'Falta `activo` o `password`' }, { status: 400 })
    }
    if (body.activo !== undefined && typeof body.activo !== 'boolean') {
      return NextResponse.json({ error: '`activo` debe ser booleano' }, { status: 400 })
    }
    if (body.password !== undefined && typeof body.password !== 'string') {
      return NextResponse.json({ error: '`password` debe ser texto' }, { status: 400 })
    }

    let activo: boolean | undefined
    if (typeof body.activo === 'boolean') {
      const r = await fijarExigirReautenticacion(g.usuario.tenantId, body.activo)
      activo = r.activo
      await registrarAccion(
        g.usuario,
        r.activo ? 'Activó el control de cambios' : 'Desactivó el control de cambios',
        r.activo
          ? 'Los cambios sensibles exigirán una contraseña — la propia de cada quien o la que asigne el Dueño'
          : 'Los cambios sensibles dejan de pedir contraseña',
      )
    }
    if (typeof body.password === 'string') {
      const r = await fijarContrasenaCambios(g.usuario.tenantId, body.password)
      if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })
      await registrarAccion(g.usuario, 'Asignó la contraseña del control de cambios', 'Contraseña compartida rotada')
    }
    return NextResponse.json({ ok: true, ...(activo !== undefined ? { activo } : {}) })
  } catch (e) {
    return respuestaError(e)
  }
}
