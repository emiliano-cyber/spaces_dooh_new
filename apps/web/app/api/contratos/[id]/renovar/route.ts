import { NextResponse } from 'next/server'
import { exigirCambioSensible } from '@/lib/server/cambios'
import { iniciarRenovacionCtrl } from '@/lib/server/arrendadores-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/contratos/[id]/renovar → contrato a RENOVADO + 1 año de vigencia.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  // Cambio sensible (dinero): exige el permiso del rol Y, si el Dueno activo el
  // control de cambios, que la sesion este desbloqueada.
  const gc = await exigirCambioSensible('arrendadores', 'crear')
  if (!gc.ok) return gc.res
  const g = { usuario: gc.usuario }
  try {
    const contrato = await iniciarRenovacionCtrl(params.id, await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Inició renovación de contrato', contrato.id)
    return NextResponse.json(contrato)
  } catch (e) {
    return respuestaError(e)
  }
}
