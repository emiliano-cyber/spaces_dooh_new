import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { guardarContratoCtrl } from '@/lib/server/campanas-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/campanas/:id/contrato  { contratoUrl } → adjunta (o quita) el
// contrato firmado del cliente al expediente de facturación (comercial.crear).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const camp = await guardarContratoCtrl(params.id, await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Adjuntó contrato del cliente', camp.nombre)
    return NextResponse.json(camp)
  } catch (e) {
    return respuestaError(e)
  }
}
