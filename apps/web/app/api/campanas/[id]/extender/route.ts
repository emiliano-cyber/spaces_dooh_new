import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { extenderCampanaCtrl } from '@/lib/server/campanas-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/campanas/:id/extender  { fechaFin } (requiere comercial.crear)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const c = await extenderCampanaCtrl(params.id, await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Extendió campaña', c.nombre)
    return NextResponse.json(c)
  } catch (e) {
    return respuestaError(e)
  }
}
