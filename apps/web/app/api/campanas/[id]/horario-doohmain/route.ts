import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { respuestaError } from '@/lib/server/errores'
import { esUuid } from '@/lib/server/notificaciones-ids'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { fijarHorarioDoohmainCtrl } from '@/lib/server/horario-doohmain'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/campanas/:id/horario-doohmain → el horario INDIVIDUAL de la campaña
// en DOOHmain (22/10): `{ horario: { horaInicio, horaFin, dias? } }`, o
// `{ horario: null }` para quitarlo. Gana sobre la franja programada y la
// contratada, y viaja al publicar. Pide `comercial.crear`, como enviar y
// aprobar la publicación. No mueve dinero: es instrucción de operación.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  if (!esUuid(params.id)) return NextResponse.json({ error: 'Esa campaña no existe' }, { status: 404 })
  try {
    const { horario: h, campana } = await fijarHorarioDoohmainCtrl(params.id, await req.json().catch(() => ({})))
    await registrarAccion(
      g.usuario,
      h
        ? `Fijó el horario en DOOHmain: ${h.horaInicio} a ${h.horaFin}${h.dias ? ` (días ${h.dias.join(',')})` : ''}`
        : 'Quitó el horario individual en DOOHmain',
      campana,
    )
    return NextResponse.json({ horario: h })
  } catch (e) {
    return respuestaError(e)
  }
}
