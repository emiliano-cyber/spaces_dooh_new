import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { iniciarRenovacionCtrl } from '@/lib/server/arrendadores-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/contratos/[id]/renovar → contrato a RENOVADO + 1 año de vigencia.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('arrendadores', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const contrato = await iniciarRenovacionCtrl(params.id)
    await registrarAccion(g.usuario, 'Inició renovación de contrato', contrato.id)
    return NextResponse.json(contrato)
  } catch (e) {
    return respuestaError(e)
  }
}
