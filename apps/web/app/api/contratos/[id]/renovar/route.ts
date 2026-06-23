import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { iniciarRenovacion } from '@/lib/server/arrendadores-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/contratos/[id]/renovar → contrato a RENOVADO + 1 año de vigencia.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('arrendadores', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const contrato = await iniciarRenovacion(params.id)
  if (!contrato) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
  await registrarAccion(g.usuario, 'Inició renovación de contrato', contrato.id)
  return NextResponse.json(contrato)
}
