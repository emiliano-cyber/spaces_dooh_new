import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { listarOrdenesImpresion } from '@/lib/server/impresion-repo'
import { crearOrdenImpresionCtrl } from '@/lib/server/impresion-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/impresion → órdenes de impresión
export async function GET() {
  const g = await exigir()
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  return NextResponse.json(await listarOrdenesImpresion())
}

// POST /api/impresion → crea una orden de impresión (requiere imprenta.crear)
export async function POST(req: Request) {
  const g = await exigir('imprenta', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const oi = await crearOrdenImpresionCtrl(await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Creó orden de impresión', oi.folio)
    return NextResponse.json(oi, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
