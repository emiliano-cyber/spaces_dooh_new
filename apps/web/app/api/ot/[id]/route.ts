import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { getOTcompleta } from '@/lib/server/ot-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/ot/:id → OT con sitio, campaña y evidencias (vista móvil standalone)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir()
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const data = await getOTcompleta(params.id)
  if (!data) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  return NextResponse.json(data)
}
