import { NextResponse } from 'next/server'
import { exigirCambioSensible } from '@/lib/server/cambios'
import { registrarPagoRentaCtrl } from '@/lib/server/arrendadores-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/pagos-renta/[id]/pagar → marca el pago de renta como PAGADO.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  // Cambio sensible (dinero): exige el permiso del rol Y, si el Dueno activo el
  // control de cambios, que la sesion este desbloqueada.
  const gc = await exigirCambioSensible('arrendadores', 'crear')
  if (!gc.ok) return gc.res
  const g = { usuario: gc.usuario }
  try {
    const pago = await registrarPagoRentaCtrl(params.id, await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Registró pago de renta', pago.periodo)
    return NextResponse.json(pago)
  } catch (e) {
    return respuestaError(e)
  }
}
