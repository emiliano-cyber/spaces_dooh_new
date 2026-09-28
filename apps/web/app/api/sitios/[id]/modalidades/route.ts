import { NextResponse } from 'next/server'
import { exigirCambioSensible } from '@/lib/server/cambios'
import { actualizarModalidadesCtrl } from '@/lib/server/sitios-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  PATCH /api/sitios/:id/modalidades — las tarifas por UNIDAD DE VENTA.
// ----------------------------------------------------------------------------
//  POR QUÉ ESTA RUTA EXISTE EN VEZ DE UN CAMPO MÁS EN EL PATCH GENERAL, que es
//  lo primero que uno intentaría y sería un agujero:
//
//  `app/api/sitios/[id]/route.ts` decide el candado por CAMPO, con una lista
//  blanca (`CAMPOS_SENSIBLES`): `tarifaPublicada`, `tarifaMensual`,
//  `costoCompra`, `precioM2`, `tarifaImpresion`, `arrendadorId` y `predioId`.
//  Está bien pensado — editar el nombre o las notas no debería costarle una
//  contraseña al trabajo diario del equipo comercial.
//
//  Pero `sitio_modalidades.tarifa_publicada` es EL MISMO DINERO que
//  `sitios.tarifa_publicada`, solo que por unidad. Añadir `modalidadesDetalle` a
//  esa lista habría funcionado, y aun así habría sido la decisión equivocada por
//  dos motivos:
//
//   1 · Una lista blanca protege lo que alguien se acordó de escribir. El día que
//       llegue otra tarifa por unidad —una mínima por campaña, un recargo por
//       franja— nadie se acordará, y el hueco no dará ningún error: el candado
//       simplemente dejará pasar. Aquí NO hay lista: la ruta entera es sensible,
//       así que no hay nada que olvidarse de añadir.
//   2 · El PATCH general lee el cuerpo para decidir si pide la contraseña. Cada
//       campo nuevo que mueva dinero es una ocasión más de equivocarse en esa
//       decisión.
//
//  SE USA `exigirCambioSensible` (o sea, `exigirDesbloqueo`) Y NO
//  `exigirReautenticacionSiempre`, y es deliberado: el trato tiene que ser
//  EXACTAMENTE el de `tarifaPublicada` en el PATCH general —ni más estricto, ni
//  más laxo—. Pedir aquí más que para la tarifa escalar del mismo dinero sería
//  una incoherencia, y las incoherencias se acaban resolviendo por el lado malo.
//  Si el Dueño decide que las tarifas pidan contraseña SIEMPRE, eso se cambia en
//  los dos sitios a la vez y es otra decisión (ver ADR 0036).
//
//  Lo que NO hace falta: migración. `sitio_modalidades` existe desde siempre con
//  su `unique (sitio_id, unidad)` (`db/schema.sql:204-212`). Lo que faltaba no
//  era la tabla: era la puerta.
// ============================================================================
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigirCambioSensible('inventario', 'crear')
  if (!g.ok) return g.res
  try {
    const body = await req.json().catch(() => ({}))
    const { sitio, guardadas, quitadas } = await actualizarModalidadesCtrl(params.id, body)
    // Solo se registra si de verdad cambió algo: abrir el cuadro y cerrarlo no
    // es una edición, y una bitácora con ruido deja de leerse.
    if (guardadas || quitadas) {
      await registrarAccion(g.usuario, 'Cambió las tarifas por unidad', sitio.nombre)
    }
    return NextResponse.json(sitio)
  } catch (e) {
    return respuestaError(e)
  }
}
