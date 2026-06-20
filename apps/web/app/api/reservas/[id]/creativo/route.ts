import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { setCreativosDeReserva } from '@/lib/server/creativos-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/reservas/:id/creativo  { creativos: [{ creatividadId, veces }] }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => null)
  try {
    const res = await setCreativosDeReserva(params.id, body?.creativos ?? [])
    if (!res) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
    return NextResponse.json({ creativos: res })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo asignar' }, { status: 400 })
  }
}
