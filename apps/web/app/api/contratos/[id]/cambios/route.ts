import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { cambiosDeContrato } from '@/lib/server/arrendadores-repo'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/contratos/[id]/cambios → historial de cambios del contrato: qué
// cambió, qué parte lo propuso y quién lo capturó (CONTRATO-CAMBIOS, 07/10).
// Es de `ver`, como el estado de las firmas: informa, no compromete.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('arrendadores', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await cambiosDeContrato(params.id))
  } catch (e) {
    return respuestaError(e)
  }
}
