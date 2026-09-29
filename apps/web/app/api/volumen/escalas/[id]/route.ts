import { NextResponse } from 'next/server'
import { exigirCambioSensible } from '@/lib/server/cambios'
import { guardarTramoCtrl, borrarTramoCtrl } from '@/lib/server/volumen-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  /api/volumen/escalas/:id — editar o BORRAR un tramo de la escala.
// ----------------------------------------------------------------------------
//  DELETE BORRA DE VERDAD, al revés que la ruta de franjas del mismo ADR, y la
//  diferencia no es un descuido. Una franja CONTRATADA es un hecho con FK
//  (`propuesta_items_franja_fkey`, `on delete restrict`), así que allí un
//  borrado real devolvería un 500 en cuanto una franja se vendiera. Un tramo de
//  volumen no lo referencia nadie: la línea de propuesta copia el porcentaje y
//  el umbral al capturarla, y el snapshot los vuelve a congelar al aprobar. Por
//  eso aquí borrar es seguro, no pierde historia, y NO hace falta una columna
//  `activo` — que además chocaría con el `unique` del umbral el día que alguien
//  quisiera volver a crear el tramo de 50.
//
//  El `id` de la ruta MANDA sobre el del cuerpo. Si se tomara del cuerpo, un
//  PATCH a `/escalas/A` con `{"id":"B"}` editaría B — y ningún candado lo vería,
//  porque el candado protege la ruta, no el JSON.
// ============================================================================
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigirCambioSensible('comercial', 'crear')
  if (!g.ok) return g.res
  try {
    const body = await req.json().catch(() => ({}))
    const tramo = await guardarTramoCtrl({ ...body, id: params.id })
    await registrarAccion(
      g.usuario,
      'Editó un tramo de descuento por volumen',
      `${tramo.unidad}: desde ${tramo.desdeCantidad} → ${tramo.descuentoPct} %`,
    )
    return NextResponse.json(tramo)
  } catch (e) {
    return respuestaError(e)
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigirCambioSensible('comercial', 'crear')
  if (!g.ok) return g.res
  try {
    const r = await borrarTramoCtrl(params.id)
    await registrarAccion(g.usuario, 'Borró un tramo de descuento por volumen', params.id)
    return NextResponse.json(r)
  } catch (e) {
    return respuestaError(e)
  }
}
