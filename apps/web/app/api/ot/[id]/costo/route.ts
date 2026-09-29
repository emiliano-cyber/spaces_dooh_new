import { NextResponse } from 'next/server'
import { exigirCambioSensible } from '@/lib/server/cambios'
import { fijarCostoOTCtrl } from '@/lib/server/ot-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  PATCH /api/ot/:id/costo  { costoReal: number | null }   OT-COSTO-01
// ----------------------------------------------------------------------------
//  Fija (o borra) lo que de VERDAD costó una orden de trabajo.
//
//  ─── POR QUÉ ES UNA RUTA PROPIA Y NO UN CAMPO DE `cerrar` ─────────────────
//  Lo natural parecía meterlo en el cierre —el costo se sabe cuando el trabajo
//  se acaba— y es justo lo que NO se hizo, por tres motivos medidos:
//
//   1. **El cierre lo hace un técnico en la calle, con el teléfono.** Si el
//      costo viajara en `cerrar`, esa ruta pasaría a ser de dinero y tendría que
//      llevar el candado de cambios; el día que una organización encienda
//      `exigir_reautenticacion`, cerrar una OT con la foto testigo empezaría a
//      pedir contraseña en mitad de la calle. El candado estaría protegiendo el
//      campo equivocado.
//   2. **El costo se sabe DESPUÉS**, muchas veces días después: la cuadrilla
//      pasa su factura cuando pasa. Atarlo al cierre obligaría a retrasar el
//      cierre —y con él la foto comprobatoria, que destraba la facturación de la
//      campaña— por un dato que no bloquea nada.
//   3. **Las OT ya cerradas no tendrían forma de capturarlo nunca.** El día que
//      esto se despliega, TODAS lo están.
//
//  ─── SÍ PASA POR EL CANDADO DE CAMBIOS, Y AQUÍ SÍ CORRESPONDE ─────────────
//  Es dinero, y del que no se ve: entra al costo de operación del reporte de
//  rentabilidad restando del margen, sin comprobante ni contraparte que lo
//  cuadre. Mismo trato que facturar una campaña, registrar un pago de renta o
//  cobrar una cobranza. El permiso sigue siendo `operaciones.crear` —los mismos
//  que ya trabajan las OT, hoy DUENO y OPERACIONES—: esto NO cambia quién entra
//  al módulo, añade la segunda puerta sobre un campo de dinero.
//
//  La bitácora guarda el importe en el texto, como hacen las rutas de pago: sin
//  él, «Capturó el costo de OT-2026-0001» no permite reconstruir qué se cambió.
// ============================================================================
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const gc = await exigirCambioSensible('operaciones', 'crear')
  if (!gc.ok) return gc.res
  try {
    const ot = await fijarCostoOTCtrl(params.id, await req.json().catch(() => ({})))
    await registrarAccion(
      gc.usuario,
      ot.costoReal == null
        ? 'Borró el costo real de la OT (vuelve a la estimación por tipo)'
        : `Capturó el costo real de la OT: $${Math.round(ot.costoReal).toLocaleString('es-MX')}`,
      ot.folio,
    )
    return NextResponse.json(ot)
  } catch (e) {
    return respuestaError(e)
  }
}
