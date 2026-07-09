import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { setCreativosReservaCtrl } from '@/lib/server/creativos-controller'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/reservas/:id/creativo  { creativos: [{ creatividadId, veces }] }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const res = await setCreativosReservaCtrl(params.id, await req.json().catch(() => ({})))
    return NextResponse.json(res)
  } catch (e) {
    return respuestaError(e)
  }
}
