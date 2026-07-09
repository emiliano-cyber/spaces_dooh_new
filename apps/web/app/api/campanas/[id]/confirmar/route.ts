import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { confirmarReservaCtrl } from '@/lib/server/campanas-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/campanas/:id/confirmar (requiere comercial.crear)
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const c = await confirmarReservaCtrl(params.id)
    await registrarAccion(g.usuario, 'Confirmó reserva', c.nombre)
    return NextResponse.json(c)
  } catch (e) {
    return respuestaError(e)
  }
}
