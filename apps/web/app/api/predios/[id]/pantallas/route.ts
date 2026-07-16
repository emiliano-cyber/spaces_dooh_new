import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { agregarPantallaAPredioCtrl } from '@/lib/server/arrendadores-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/predios/[id]/pantallas → cuelga una pantalla del predio SIN crear un
// contrato nuevo: la renta ya la define el contrato del predio y se reparte entre
// sus pantallas. Body: { sitioId } (liga una existente) o los datos de una nueva.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('arrendadores', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const r = await agregarPantallaAPredioCtrl(params.id, await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Agregó pantalla al predio', r.sitioId)
    return NextResponse.json(r, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
