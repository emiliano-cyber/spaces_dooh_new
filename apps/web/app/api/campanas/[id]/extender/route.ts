import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { extenderCampana } from '@/lib/server/campanas-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/campanas/:id/extender  { fechaFin } (requiere comercial.crear)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => null)
  if (!body?.fechaFin) return NextResponse.json({ error: 'Falta fechaFin' }, { status: 400 })
  const c = await extenderCampana(params.id, body.fechaFin)
  if (!c) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  return NextResponse.json(c)
}
