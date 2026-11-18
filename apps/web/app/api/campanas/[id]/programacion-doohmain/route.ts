import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { respuestaError } from '@/lib/server/errores'
import { esUuid } from '@/lib/server/notificaciones-ids'
import { doohmainHabilitado, vistaPreviaDoohmain } from '@/lib/server/doohmain'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/campanas/:id/programacion-doohmain → lo que se le va a mandar a
// DOOHmain, SIN mandarlo: por pantalla, a qué pantalla de DOOHmain va, las
// reproducciones por día y en total, y el horario si la campaña tiene franja.
// Pedido del dueño (22/10): verlo en la campaña antes de subirla. Sale de la
// MISMA consulta que publica (`leerPlan()` en `lib/server/doohmain.ts`).
//
// Solo lee: pide `comercial.ver`. Una campaña de otra organización no la
// encuentra la RLS, y un id que no es uuid no llega a la base: las dos, 404.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  if (!esUuid(params.id)) return NextResponse.json({ error: 'Esa campaña no existe' }, { status: 404 })
  try {
    const v = await vistaPreviaDoohmain(params.id)
    if (!v) return NextResponse.json({ error: 'Esa campaña no existe' }, { status: 404 })
    return NextResponse.json({ ...v, publicacionEncendida: doohmainHabilitado() })
  } catch (e) {
    return respuestaError(e)
  }
}
