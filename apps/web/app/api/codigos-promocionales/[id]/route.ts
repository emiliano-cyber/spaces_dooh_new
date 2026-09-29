import { NextResponse } from 'next/server'
import { exigirCambioSensible } from '@/lib/server/cambios'
import { guardarCodigoCtrl, borrarCodigoCtrl } from '@/lib/server/codigos-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  /api/codigos-promocionales/:id — editar o BORRAR un código promocional.
//  ADR 0039, Fase 3.
// ----------------------------------------------------------------------------
//  DELETE BORRA DE VERDAD, como el tramo de volumen y al revés que una franja.
//  Nada del precio depende de esta fila: al canjear, el texto y el porcentaje
//  se copian a `propuestas.codigo_texto` y `propuestas.codigo_descuento_pct`, y
//  el snapshot los vuelve a congelar al aprobar. Por eso borrar un cupón
//  **no mueve ni una venta**, ni la capturada ni la aprobada — que es el
//  invariante 3 del ADR 0039 y tiene prueba en unitarias y en e2e.
//
//  Lo que sí se lleva por delante son sus CANJES (`on delete cascade`), y es lo
//  correcto: el presupuesto deja de existir, así que contar contra él deja de
//  tener sentido. La consecuencia hay que saberla: **borrar y volver a crear el
//  mismo código reinicia su cuenta de usos.** Si lo que se quiere es apagarlo
//  sin perder la cuenta, se le pone la fecha de fin en el pasado.
//
//  EDITAR TAMPOCO MUEVE NADA YA VENDIDO. Subir VERANO20 del 20 % al 30 % se
//  aplica a los canjes de mañana y a ninguno de ayer.
//
//  El `id` de la ruta MANDA sobre el del cuerpo. Si se tomara del cuerpo, un
//  PATCH a `/codigos-promocionales/A` con `{"id":"B"}` editaría B — y ningún
//  candado lo vería, porque el candado protege la ruta, no el JSON.
// ============================================================================
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigirCambioSensible('precios', 'crear')
  if (!g.ok) return g.res
  try {
    const body = await req.json().catch(() => ({}))
    const cod = await guardarCodigoCtrl({ ...body, id: params.id })
    await registrarAccion(
      g.usuario,
      'Editó un código promocional',
      `${cod.codigo}: ${cod.descuentoPct} % · del ${cod.vigenteDesde} al ${cod.vigenteHasta}`,
    )
    return NextResponse.json(cod)
  } catch (e) {
    return respuestaError(e)
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigirCambioSensible('precios', 'crear')
  if (!g.ok) return g.res
  try {
    const r = await borrarCodigoCtrl(params.id)
    await registrarAccion(g.usuario, 'Borró un código promocional', params.id)
    return NextResponse.json(r)
  } catch (e) {
    return respuestaError(e)
  }
}
