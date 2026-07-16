import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { editarContratoCtrl } from '@/lib/server/arrendadores-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/contratos/[id] → editar contrato (recalcula estatus por fechas).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('arrendadores', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const contrato = await editarContratoCtrl(params.id, await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Editó contrato', contrato.id)
    return NextResponse.json(contrato)
  } catch (e) {
    return respuestaError(e)
  }
}
