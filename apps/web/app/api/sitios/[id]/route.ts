import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { actualizarSitio, borrarSitio, toggleNetwork } from '@/lib/server/sitios-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/sitios/:id  → edición parcial. Body { toggleNetwork:true } alterna red.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => ({}))
  const sitio = body?.toggleNetwork
    ? await toggleNetwork(params.id)
    : await actualizarSitio(params.id, body ?? {})
  if (!sitio) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(sitio)
}

// DELETE /api/sitios/:id
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  await borrarSitio(params.id)
  return NextResponse.json({ ok: true })
}
