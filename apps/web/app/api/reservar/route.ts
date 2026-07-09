import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { reservarCtrl } from '@/lib/server/reservas-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/reservar → crea reserva tentativa (requiere permiso comercial.crear).
export async function POST(req: Request) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const campana = await reservarCtrl(await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Reservó (tentativa)', campana.nombre)
    return NextResponse.json(campana, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
