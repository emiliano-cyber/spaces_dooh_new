import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { fijarFechaEspecialCtrl } from '@/lib/server/impresion-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/impresion/:id/fecha-especial { fechaEspecial: 'YYYY-MM-DD' | null }
// → la fecha requerida de la orden, que manda sobre el inicio de la campaña en
// la cola de Imprenta (FLUJO-CREA, 20/11). null la quita. Mismo permiso que
// avanzar la orden (imprenta.crear). Fecha que no existe → 400; id no uuid, de
// otra organización o inexistente → 404.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('imprenta', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  try {
    const oi = await fijarFechaEspecialCtrl(params.id, await req.json().catch(() => ({})))
    await registrarAccion(
      g.usuario,
      oi.fechaEspecial ? `Puso fecha especial de impresión: ${oi.fechaEspecial}` : 'Quitó la fecha especial de impresión',
      oi.folio,
    )
    return NextResponse.json(oi)
  } catch (e) {
    return respuestaError(e)
  }
}
