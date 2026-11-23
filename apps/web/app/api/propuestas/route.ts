import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { crearPropuestaCtrl } from '@/lib/server/propuestas-controller'
import { soloDe as soloDeOportunidades } from '@/lib/server/oportunidades-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { textoBitacoraAjusteTarifa } from '@/lib/tarifa-calculada'
import { monedaDeLaInstancia } from '@/lib/server/moneda-instancia'
import { avisosDePropuesta } from '@/lib/server/propuestas-competencia'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/propuestas → crea una propuesta (borrador) con sus sitios.
//
// PRECIO-01 · la tarifa de cada sitio la calcula el SERVIDOR. Quien no tiene
// `comercial.aprobar` y manda otro precio recibe un 403 y no se guarda nada
// (lo decide `crearPropuestaCtrl`). Quien sí lo tiene puede apartarse, y cada
// línea ajustada queda en Actividad con la tarifa calculada y el precio nuevo:
// es dinero, y «quién lo movió y cuánto» no puede vivir solo en una columna.
export async function POST(req: Request) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const { propuesta, ajustes } = await crearPropuestaCtrl(await req.json().catch(() => ({})), {
      soloDeOportunidad: await soloDeOportunidades(g.usuario),
    })
    await registrarAccion(g.usuario, 'Creó propuesta', propuesta.nombre)
    // ADR 0048 · la frase lleva importes con el simbolo de la moneda de la
    // instancia; en servidor hay que pedirla antes de escribirla.
    await monedaDeLaInstancia()
    for (const a of ajustes) {
      await registrarAccion(g.usuario, textoBitacoraAjusteTarifa(a), propuesta.nombre)
    }
    // PROP-MARCA (20/11) · la competencia de marcas de Vallas, ya con la
    // propuesta guardada. SOLO AVISA: `avisosDePropuesta` nunca lanza, y se
    // calcula DESPUÉS de guardar, así que no hay forma de que impida el alta.
    return NextResponse.json(
      { ...propuesta, avisosCompetencia: await avisosDePropuesta(propuesta.id) },
      { status: 201 },
    )
  } catch (e) {
    return respuestaError(e)
  }
}
