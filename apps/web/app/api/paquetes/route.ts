import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { exigirCambioSensible } from '@/lib/server/cambios'
import { listarPaquetesCtrl, guardarPaqueteCtrl } from '@/lib/server/paquetes-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  /api/paquetes — los PAQUETES CERRADOS de la organización. ADR 0039, Fase 4.
// ----------------------------------------------------------------------------
//  CADA EMPRESA PONE LOS SUYOS. Es la regla 3 del ADR 0039, dictada por el
//  dueño el 2026-09-28. La tabla nace con `tenant_id` y RLS `enable` + `force`,
//  cerrada por los dos lados.
//
//  ─── EL CANDADO: leer con `inventario.ver`, ESCRIBIR como cambio SENSIBLE ──
//  Crear un paquete es fijar el precio de una venta entera saltándose la
//  rejilla. Es el cambio de precio más grande que este producto admite: un
//  paquete de cinco pantallas a 1 000 vende por 1 000 lo que el tarifario dice
//  que vale 250 000, y **no dispara ninguna alarma de descuento porque no ES un
//  descuento**. Por eso escribir aquí pide exactamente lo mismo que una tarifa:
//  `exigirCambioSensible`, la ruta ENTERA, sin lista blanca de campos.
//
//  ⚠️ CREAR UN PAQUETE Y APLICARLO SON DOS PERMISOS DISTINTOS, Y ES EL PUNTO.
//  Aquí se pide `inventario` —Administración—; aplicarlo vive en
//  `/api/propuestas/:id/paquete` y pide `comercial.crear`. Si fueran el mismo,
//  quien vende se crearía su propio paquete al precio que quisiera y se lo
//  aplicaría, que es el tope de descuento del 28/09 evadido por completo.
// ============================================================================

export async function GET() {
  const g = await exigir('comercial', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await listarPaquetesCtrl())
  } catch (e) {
    return respuestaError(e)
  }
}

export async function POST(req: Request) {
  const g = await exigirCambioSensible('comercial', 'crear')
  if (!g.ok) return g.res
  try {
    const paq = await guardarPaqueteCtrl(await req.json().catch(() => ({})))
    // La bitácora DICE EL PRECIO Y CUÁNTAS PANTALLAS. Un «creó un paquete»
    // pelado no permitiría explicar seis meses después por qué una venta salió
    // a ese importe; mismo criterio que TOPE-02 con el descuento.
    await registrarAccion(
      g.usuario,
      'Creó un paquete cerrado',
      `${paq.nombre}: $${paq.precioCerrado.toLocaleString('es-MX')} por ${paq.sitios.length} pantalla(s)` +
        `${paq.admiteCodigo ? ' · admite código promocional' : ' · precio final, sin códigos'}`,
    )
    return NextResponse.json(paq, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
