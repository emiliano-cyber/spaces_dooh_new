import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { actualizarSitioCtrl, borrarSitioCtrl } from '@/lib/server/sitios-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/sitios/:id  → edición parcial. Body { toggleNetwork:true } alterna red.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const { sitio, toggled } = await actualizarSitioCtrl(params.id, await req.json().catch(() => ({})))
    await registrarAccion(
      g.usuario,
      toggled ? (sitio.enNetwork ? 'Compartió en Network' : 'Quitó de Network') : 'Editó pantalla',
      sitio.nombre,
    )
    return NextResponse.json(sitio)
  } catch (e) {
    return respuestaError(e)
  }
}

// DELETE /api/sitios/:id
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const nombre = await borrarSitioCtrl(params.id)
    await registrarAccion(g.usuario, 'Eliminó pantalla', nombre)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return respuestaError(e)
  }
}
