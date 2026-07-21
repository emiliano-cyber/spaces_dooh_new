import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { listarOT } from '@/lib/server/ot-repo'
import { crearOTCtrl } from '@/lib/server/ot-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/ot → lista de órdenes de trabajo (requiere operaciones.ver)
export async function GET() {
  const g = await exigir('operaciones', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  return NextResponse.json(await listarOT())
}

// POST /api/ot → crea OT (requiere operaciones.crear)
export async function POST(req: Request) {
  const g = await exigir('operaciones', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const ot = await crearOTCtrl(await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Creó OT', ot.folio)
    return NextResponse.json(ot, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
