import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { actualizarGrupoCtrl, borrarGrupoCtrl, esUuid } from '@/lib/server/vallas-controller'
import { GRUPO_NO_ENCONTRADO } from '@/lib/server/vallas-repo'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/vallas/grupos/:id → edita; `vallaIds` deja EXACTAMENTE esas.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('inventario', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  if (!esUuid(params.id)) return NextResponse.json({ error: GRUPO_NO_ENCONTRADO }, { status: 404 })
  try {
    const gr = await actualizarGrupoCtrl(params.id, await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Actualizó un grupo de vallas', gr.numero)
    return NextResponse.json(gr)
  } catch (e) {
    return respuestaError(e)
  }
}

// DELETE /api/vallas/grupos/:id → lo borra; sus vallas quedan sueltas.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('inventario', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  if (!esUuid(params.id)) return NextResponse.json({ error: GRUPO_NO_ENCONTRADO }, { status: 404 })
  try {
    const r = await borrarGrupoCtrl(params.id)
    await registrarAccion(g.usuario, 'Borró un grupo de vallas', params.id)
    return NextResponse.json(r)
  } catch (e) {
    return respuestaError(e)
  }
}
