import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { reservar } from '@/lib/server/campanas-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/reservar → crea reserva tentativa (requiere permiso comercial.crear).
export async function POST(req: Request) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => null)
  if (!body?.sitioIds?.length) return NextResponse.json({ error: 'Sin sitios' }, { status: 400 })
  try {
    const campana = await reservar(body)
    await registrarAccion(g.usuario, 'Reservó (tentativa)', campana.nombre)
    return NextResponse.json(campana, { status: 201 })
  } catch (e) {
    // Colisión de fechas u otra regla de negocio → 409 con el mensaje al usuario.
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'No se pudo reservar' },
      { status: 409 },
    )
  }
}
