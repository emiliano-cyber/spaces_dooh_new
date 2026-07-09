import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { marcarOCCtrl } from '@/lib/server/campanas-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/campanas/:id/oc  { ocUrl? } → registra la OC del cliente (comercial.crear)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const camp = await marcarOCCtrl(params.id, await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Registró OC del cliente', camp.nombre)
    return NextResponse.json(camp)
  } catch (e) {
    return respuestaError(e)
  }
}
