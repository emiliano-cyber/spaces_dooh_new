import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { listarOrdenesImpresion, crearOrdenImpresion, ImpresionError } from '@/lib/server/impresion-repo'
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
  const body = await req.json().catch(() => null)
  if (!body?.campanaId) return NextResponse.json({ error: 'Falta la campaña' }, { status: 400 })
  try {
    const oi = await crearOrdenImpresion(body)
    await registrarAccion(g.usuario, 'Creó orden de impresión', oi.folio)
    return NextResponse.json(oi, { status: 201 })
  } catch (e) {
    // Transición inválida (p. ej. DOOH → imprenta) → 409 con mensaje claro.
    if (e instanceof ImpresionError) return NextResponse.json({ error: e.message }, { status: 409 })
    throw e
  }
}
