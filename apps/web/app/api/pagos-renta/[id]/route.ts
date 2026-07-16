import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { adjuntarAPagoCtrl } from '@/lib/server/arrendadores-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/pagos-renta/[id] → adjunta/reemplaza factura y comprobante del pago.
// No re-sella el pago (no toca estatus ni fecha): la factura suele llegar días
// después, y corregir un adjunto no es volver a pagar.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('arrendadores', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const p = await adjuntarAPagoCtrl(params.id, await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Actualizó adjuntos del pago', p.periodo)
    return NextResponse.json(p)
  } catch (e) {
    return respuestaError(e)
  }
}
