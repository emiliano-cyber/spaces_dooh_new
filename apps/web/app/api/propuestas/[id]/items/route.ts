import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { agregarSitiosCtrl } from '@/lib/server/propuestas-controller'
import { textoBitacoraAjusteTarifa } from '@/lib/tarifa-calculada'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/propuestas/[id]/items → agrega sitios a una propuesta en BORRADOR o
// ENVIADA (PROP-COMPLETA, 29/10). Cuerpo `{ items }` con la misma forma que el
// alta: el servidor calcula precio, volumen y tarifa igual que al crear.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const body = await req.json().catch(() => ({}))
    const { propuesta, ajustes } = await agregarSitiosCtrl(params.id, body)
    const n = Array.isArray(body?.items) ? body.items.length : 0
    await registrarAccion(
      g.usuario,
      `Agregó ${n} sitio${n === 1 ? '' : 's'} a la propuesta${propuesta.version > 1 ? ` (v${propuesta.version})` : ''}`,
      propuesta.nombre,
    )
    // PRECIO-01 · como en el alta, con la misma frase: cada tarifa apartada de
    // la calculada queda en Actividad.
    for (const a of ajustes) {
      await registrarAccion(g.usuario, textoBitacoraAjusteTarifa(a), propuesta.nombre)
    }
    return NextResponse.json(propuesta, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
