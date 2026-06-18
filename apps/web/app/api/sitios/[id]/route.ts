import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { actualizarSitio, borrarSitio, toggleNetwork, getSitio } from '@/lib/server/sitios-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'

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
  await registrarAccion(
    g.usuario,
    body?.toggleNetwork ? (sitio.enNetwork ? 'Compartió en Network' : 'Quitó de Network') : 'Editó pantalla',
    sitio.nombre,
  )
  return NextResponse.json(sitio)
}

// DELETE /api/sitios/:id
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const previo = await getSitio(params.id)
  try {
    await borrarSitio(params.id)
  } catch (e) {
    // 23503 = foreign_key_violation: el sitio tiene reservas / OT / impresión asociadas.
    if ((e as { code?: string })?.code === '23503') {
      return NextResponse.json(
        { error: 'No se puede eliminar: la pantalla tiene reservas u órdenes asociadas.' },
        { status: 409 },
      )
    }
    throw e
  }
  await registrarAccion(g.usuario, 'Eliminó pantalla', previo?.nombre ?? params.id)
  return NextResponse.json({ ok: true })
}
