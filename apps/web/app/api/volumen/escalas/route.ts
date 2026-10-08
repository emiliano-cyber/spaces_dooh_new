import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { exigirCambioSensible } from '@/lib/server/cambios'
import { listarEscalasCtrl, guardarTramoCtrl } from '@/lib/server/volumen-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { formatNumero } from '@/lib/formato-numero'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  /api/volumen/escalas — la escala de DESCUENTO POR VOLUMEN de la
//  organización.  ADR 0039, Fase 2.
// ----------------------------------------------------------------------------
//  POR QUÉ CUELGA DE LA ORGANIZACIÓN Y NO DE CADA PANTALLA: un descuento por
//  volumen es lo que esta casa concede a quien compra mucho, no una propiedad
//  de un poste. Es de la familia de `config_negocio.tope_descuento_pct` y no de
//  la de `sitio_modalidades`. El motivo completo, con las cuatro opciones que
//  había y por qué se descartaron las otras tres, está en la cabecera de
//  `20260928_descuento_por_volumen.sql`.
//
//  ─── EL CANDADO: leer con `inventario.ver`, ESCRIBIR como cambio SENSIBLE ──
//  Un tramo de volumen NO es un dato descriptivo: decide cuánto dinero se
//  regala en cada venta que llegue al umbral, sobre TODO el inventario a la vez.
//  Mover «desde 50 → 10 %» a «desde 20 → 30 %» rebaja media cartera sin tocar
//  una sola tarifa. Por eso escribir aquí pide exactamente lo mismo que
//  `PATCH /api/sitios/:id/modalidades` y que el catálogo de franjas:
//  `exigirCambioSensible`, la ruta ENTERA, sin lista blanca de campos.
//
//  Se usa `exigirCambioSensible` —o sea `exigirDesbloqueo`— y no
//  `exigirReautenticacionSiempre`, por el mismo motivo escrito en la ruta de
//  modalidades: el trato tiene que ser EXACTAMENTE el de una tarifa, ni más
//  estricto ni más laxo, o la incoherencia se acaba resolviendo por el lado malo.
// ============================================================================

// GET → los tramos de la organización. Lo pide la pantalla de configuración y
// también el cotizador, para poder ANTICIPAR el descuento mientras se arma la
// propuesta. Ojo: eso es una PREVISTA. Quien decide el descuento que se guarda
// es el servidor, en `propuestas-controller.ts`; ver el comentario de allí.
export async function GET() {
  const g = await exigir('precios', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await listarEscalasCtrl())
  } catch (e) {
    return respuestaError(e)
  }
}

// POST → alta de un tramo. El umbral repetido y la escala no monótona se
// rechazan en el controller, con el tramo con el que chocan nombrado.
export async function POST(req: Request) {
  const g = await exigirCambioSensible('precios', 'crear')
  if (!g.ok) return g.res
  try {
    const tramo = await guardarTramoCtrl(await req.json().catch(() => ({})))
    await registrarAccion(
      g.usuario,
      'Creó un tramo de descuento por volumen',
      `${tramo.unidad}: desde ${formatNumero(tramo.desdeCantidad)} → ${tramo.descuentoPct} %`,
    )
    return NextResponse.json(tramo, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
