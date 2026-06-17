import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { listarSitios, crearSitio } from '@/lib/server/sitios-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/sitios → lista de sitios (con modalidades)
export async function GET() {
  const g = await exigir()
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  return NextResponse.json(await listarSitios())
}

// POST /api/sitios → alta de un sitio (requiere comercial.crear)
export async function POST(req: Request) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => null)
  if (!body?.nombre) return NextResponse.json({ error: 'Falta nombre' }, { status: 400 })
  const sitio = await crearSitio(body)
  return NextResponse.json(sitio, { status: 201 })
}
