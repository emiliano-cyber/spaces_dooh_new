import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { crearConsumoCtrl, tableroConsumosCtrl } from '@/lib/server/energia-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  /api/energia/consumos — la captura mensual del recibo de luz.
// ----------------------------------------------------------------------------
//  EL PERMISO ES `operaciones` Y NO `finanzas`, y es una decisión, no un
//  descuido. El dueño eligió quién teclea esto el 2026-09-18: «la hace
//  operaciones». Son dos preguntas distintas —quién captura el recibo y quién
//  ve el margen— y por eso son dos permisos: el REPORTE que consume estos datos
//  sigue exigiendo `finanzas.ver`
//  (`app/api/reportes/rentabilidad/route.ts`), porque enseña lo que se cobra
//  por cada pantalla y lo que se le paga a cada arrendador.
//
//  Consecuencia que conviene tener escrita: un rol de OPERACIONES escribe un
//  número que cambia el margen de un reporte de dinero que ese mismo rol no
//  puede abrir. Es exactamente lo que el dueño pidió, y la trazabilidad la da
//  `registrarAccion` — cada alta y cada borrado quedan en la bitácora con quién
//  los hizo.
// ============================================================================

// GET /api/energia/consumos?desde=…&hasta=…
// Devuelve la REJILLA COMPLETA de punto de medición × mes, con sus huecos — no
// solo lo capturado. Una lista de lo que existe deja invisible el mes que nadie
// tecleó, y ese mes no da error en ningún sitio: sale como un costo de luz de
// cero en el reporte.
export async function GET(req: Request) {
  const g = await exigir('operaciones', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const params = Object.fromEntries(new URL(req.url).searchParams)
    return NextResponse.json(await tableroConsumosCtrl(params))
  } catch (e) {
    return respuestaError(e)
  }
}

// POST /api/energia/consumos → alta de un recibo.
// El duplicado lo corta el índice único de la tabla y `errores.ts` lo traduce a
// un 409: capturar dos veces el mismo recibo DUPLICA el costo de la luz de ese
// mes y no da ningún error, da un margen peor de lo que es.
export async function POST(req: Request) {
  const g = await exigir('operaciones', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const c = await crearConsumoCtrl(await req.json().catch(() => ({})), g.usuario.id)
    await registrarAccion(
      g.usuario,
      'Capturó recibo de luz',
      `${c.periodo.slice(0, 7)} — ${c.kwh} kWh por ${c.importe}${c.medidor ? ` (medidor ${c.medidor})` : ''}`,
    )
    return NextResponse.json(c, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
