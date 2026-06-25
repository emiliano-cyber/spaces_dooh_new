import { NextResponse } from 'next/server'
import { obtenerPropuestaPublica } from '@/lib/server/propuestas-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/propuestas/publica/:id → datos de solo lectura de una propuesta para
// la liga compartible. SIN auth a propósito: cualquiera con la liga puede verla.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const data = await obtenerPropuestaPublica(params.id)
  if (!data) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
  return NextResponse.json(data)
}
