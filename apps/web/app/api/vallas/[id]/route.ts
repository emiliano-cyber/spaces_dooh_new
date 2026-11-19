import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { actualizarVallaCtrl, borrarVallaCtrl, esUuid } from '@/lib/server/vallas-controller'
import { VALLA_NO_ENCONTRADA } from '@/lib/server/vallas-repo'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/vallas/:id → edita una valla (número, medidas, sitio, cara…).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('inventario', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  if (!esUuid(params.id)) return NextResponse.json({ error: VALLA_NO_ENCONTRADA }, { status: 404 })
  try {
    const v = await actualizarVallaCtrl(params.id, await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Actualizó una valla', v.numero)
    return NextResponse.json(v)
  } catch (e) {
    return respuestaError(e)
  }
}

// DELETE /api/vallas/:id → la borra (todavía no tiene historia que perder).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('inventario', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  if (!esUuid(params.id)) return NextResponse.json({ error: VALLA_NO_ENCONTRADA }, { status: 404 })
  try {
    const r = await borrarVallaCtrl(params.id)
    await registrarAccion(g.usuario, 'Borró una valla', params.id)
    return NextResponse.json(r)
  } catch (e) {
    return respuestaError(e)
  }
}
