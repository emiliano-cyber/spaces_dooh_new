import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { exigirCambioSensible } from '@/lib/server/cambios'
import { actualizarRejillaCtrl } from '@/lib/server/rejilla-controller'
import { rejillaDeSitio } from '@/lib/server/rejilla-repo'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  /api/sitios/:id/rejilla — las tarifas por FRANJA y TEMPORADA de una pantalla.
//  ADR 0039, Fase 1.
// ----------------------------------------------------------------------------
//  POR QUÉ UNA RUTA PROPIA Y NO UN CAMPO MÁS EN `/modalidades`. La razón está
//  escrita en la cabecera de aquella ruta y se cumple aquí al pie de la letra:
//  «el día que llegue otra tarifa por unidad —una mínima por campaña, un recargo
//  por franja— nadie se acordará». Pues llegó. Se sigue el camino que aquel
//  archivo dejó marcado —ruta propia, sensible ENTERA, sin lista blanca de
//  campos— en vez de añadir una cadena más a un candado por campo.
//
//  Y VAN POR SEPARADO A PROPÓSITO, aunque las dos escriban precios: son DOS
//  tablas con dos semánticas distintas. `sitio_modalidades` es la tarifa base y
//  su re-importación PISA (el CSV es la verdad completa de esa pantalla);
//  `sitio_tarifas` es la rejilla y NUNCA se pisa en bloque. Meterlas en el mismo
//  cuerpo obligaría a que un solo `delete` sirviera para las dos semánticas, y
//  ése es el error que se documentó el 28/09 al abrir la captura desde la ficha.
//
//  MISMO CANDADO QUE LAS MODALIDADES, ni más ni menos: `exigirCambioSensible`
//  (o sea `exigirDesbloqueo`) y no `exigirReautenticacionSiempre`. Una tarifa por
//  franja es EL MISMO DINERO que `sitio_modalidades.tarifa_publicada`; pedir aquí
//  más que para aquélla sería una incoherencia, y las incoherencias se acaban
//  resolviendo por el lado malo.
//
//  LA LECTURA no es sensible: ver los precios es el trabajo diario de quien
//  cotiza. Lo que pide contraseña es moverlos.
// ============================================================================
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('inventario', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json({ rejilla: await rejillaDeSitio(params.id) })
  } catch (e) {
    return respuestaError(e)
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigirCambioSensible('inventario', 'crear')
  if (!g.ok) return g.res
  try {
    const body = await req.json().catch(() => ({}))
    const { rejilla, guardadas, quitadas } = await actualizarRejillaCtrl(params.id, body)
    // Solo se registra si de verdad cambió algo: abrir el cuadro y cerrarlo no
    // es una edición, y una bitácora con ruido deja de leerse. Mismo criterio
    // que la ruta de modalidades.
    if (guardadas || quitadas) {
      await registrarAccion(g.usuario, 'Cambió las tarifas por franja', params.id)
    }
    return NextResponse.json({ rejilla })
  } catch (e) {
    return respuestaError(e)
  }
}
