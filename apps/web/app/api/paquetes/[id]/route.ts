import { NextResponse } from 'next/server'
import { exigirCambioSensible } from '@/lib/server/cambios'
import { guardarPaqueteCtrl, borrarPaqueteCtrl } from '@/lib/server/paquetes-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  /api/paquetes/:id — editar o BORRAR un paquete cerrado. ADR 0039, Fase 4.
// ----------------------------------------------------------------------------
//  NI EDITAR NI BORRAR MUEVEN UNA SOLA VENTA — ni en borrador ni aprobada.
//  Al aplicar el paquete, su nombre, su precio, su bandera y su composición se
//  COPIAN a `propuestas`, y el snapshot los vuelve a congelar al aprobar. Es el
//  invariante 4 del ADR 0039 y tiene prueba en unitarias y en e2e.
//
//  Lo que sí se lleva por delante el DELETE son la composición y los ENLACES
//  VIVOS (`on delete cascade`): son presupuesto del paquete, no precio de
//  nadie. La consecuencia hay que saberla: una propuesta que lo tenía aplicado
//  conserva su precio y deja de saber de qué fila del catálogo salió — el
//  nombre congelado sigue ahí, la fila ya no.
//
//  Si lo que se quiere es dejar de venderlo sin perder su definición, se le
//  quita `activo`. Borrar es para lo que se capturó por error.
//
//  El `id` de la ruta MANDA sobre el del cuerpo. Si se tomara del cuerpo, un
//  PATCH a `/paquetes/A` con `{"id":"B"}` editaría B — y ningún candado lo
//  vería, porque el candado protege la ruta, no el JSON.
// ============================================================================
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigirCambioSensible('precios', 'crear')
  if (!g.ok) return g.res
  try {
    const body = await req.json().catch(() => ({}))
    const paq = await guardarPaqueteCtrl({ ...body, id: params.id })
    await registrarAccion(
      g.usuario,
      'Editó un paquete cerrado',
      `${paq.nombre}: $${paq.precioCerrado.toLocaleString('es-MX')} por ${paq.sitios.length} pantalla(s)`,
    )
    return NextResponse.json(paq)
  } catch (e) {
    return respuestaError(e)
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigirCambioSensible('precios', 'crear')
  if (!g.ok) return g.res
  try {
    const r = await borrarPaqueteCtrl(params.id)
    await registrarAccion(g.usuario, 'Borró un paquete cerrado', params.id)
    return NextResponse.json(r)
  } catch (e) {
    return respuestaError(e)
  }
}
