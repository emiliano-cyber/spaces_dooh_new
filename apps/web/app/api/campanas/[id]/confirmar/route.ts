import { NextResponse } from 'next/server'
import { avisarCambioDeCampanas } from '@/lib/server/space-eyes-campanas'
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
    // Space Eyes: desde confirmada, los equipos de sus pantallas la esperan.
    await avisarCambioDeCampanas()
    return NextResponse.json(c)
  } catch (e) {
    return respuestaError(e)
  }
}
