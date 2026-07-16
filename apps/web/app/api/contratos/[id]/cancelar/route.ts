import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { cancelarContratoCtrl } from '@/lib/server/arrendadores-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/contratos/[id]/cancelar → estatus CANCELADO + motivo (requerido).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('arrendadores', 'aprobar')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const contrato = await cancelarContratoCtrl(params.id, await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Canceló contrato', contrato.id)
    return NextResponse.json(contrato)
  } catch (e) {
    return respuestaError(e)
  }
}
