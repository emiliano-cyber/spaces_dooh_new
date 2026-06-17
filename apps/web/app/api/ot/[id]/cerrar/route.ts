import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { cerrarOT } from '@/lib/server/ot-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/ot/:id/cerrar  { fotoUrl, tomadaEn, lat, lng } (requiere operaciones.crear)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('operaciones', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => null)
  if (!body?.fotoUrl) return NextResponse.json({ error: 'Falta la foto comprobatoria' }, { status: 400 })
  const ot = await cerrarOT(params.id, { ...body, uploadedBy: g.usuario.id })
  if (!ot) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  return NextResponse.json(ot)
}
