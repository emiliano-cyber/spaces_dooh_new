import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { desbloquear, bloquear } from '@/lib/server/cambios'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { limitar, ipDe } from '@/lib/server/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/cambios/desbloquear → teclea la contraseña del Dueño y desbloquea
// ESTA sesión por unos minutos. El desbloqueo se guarda en el servidor (contra el
// token de sesión), no en el navegador.
export async function POST(req: Request) {
  const g = await exigir()
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  // Anti fuerza bruta: es UNA contraseña compartida por toda la organización, así
  // que sin esto se adivina probando. Límite por usuario, no por IP: varios roles
  // suelen salir por la misma IP de oficina y no deben bloquearse entre sí.
  const lim = limitar(`desbloqueo:${g.usuario.id}:${ipDe(req)}`, 5, 5 * 60_000)
  if (!lim.ok) {
    return NextResponse.json(
      { error: `Demasiados intentos. Espera ${lim.retrySeg}s.` },
      { status: 429, headers: { 'Retry-After': String(lim.retrySeg) } },
    )
  }
  try {
    const body = (await req.json().catch(() => ({}))) as { password?: unknown }
    if (typeof body.password !== 'string' || !body.password) {
      return NextResponse.json({ error: 'Falta la contraseña' }, { status: 400 })
    }
    const r = await desbloquear(body.password)
    if ('error' in r) {
      // Un intento fallido queda en bitácora: si alguien anda probando, se ve.
      if (r.status === 403) await registrarAccion(g.usuario, 'Contraseña de cambios incorrecta', 'Intento fallido de desbloqueo')
      return NextResponse.json({ error: r.error }, { status: r.status })
    }
    await registrarAccion(g.usuario, 'Desbloqueó los cambios', `Con la contraseña del Dueño, hasta ${new Date(r.hasta).toLocaleTimeString('es-MX')}`)
    return NextResponse.json(r)
  } catch (e) {
    return respuestaError(e)
  }
}

// DELETE /api/cambios/desbloquear → vuelve a bloquear esta sesión.
export async function DELETE() {
  const g = await exigir()
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    await bloquear()
    return NextResponse.json({ ok: true })
  } catch (e) {
    return respuestaError(e)
  }
}
