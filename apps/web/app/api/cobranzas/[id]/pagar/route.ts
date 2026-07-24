import { NextResponse } from 'next/server'
import { exigirCambioSensible } from '@/lib/server/cambios'
import { registrarPagoCtrl } from '@/lib/server/finanzas-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { notificar } from '@/lib/server/notificaciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/cobranzas/:id/pagar { monto? } → registra pago/abono (finanzas.crear)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  // Cambio sensible (dinero): exige el permiso del rol Y, si el Dueno activo el
  // control de cambios, que la sesion este desbloqueada.
  const gc = await exigirCambioSensible('finanzas', 'crear')
  if (!gc.ok) return gc.res
  const g = { usuario: gc.usuario }
  try {
    const c = await registrarPagoCtrl(params.id, await req.json().catch(() => ({})))
    const montoTxt = `$${Math.round(c.abono ?? 0).toLocaleString('es-MX')}`
    await registrarAccion(
      g.usuario,
      c.liquidado ? `Registró pago ${montoTxt} (liquidado)` : `Registró abono ${montoTxt}`,
      c.folio ?? 'cobranza',
    )
    await notificar({ tipo: 'PAGO', nivel: 'ok', titulo: c.liquidado ? 'Cobranza liquidada' : 'Abono registrado', detalle: c.folio ?? 'cobranza', link: '/finanzas' })
    return NextResponse.json(c)
  } catch (e) {
    return respuestaError(e)
  }
}
