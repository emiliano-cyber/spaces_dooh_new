import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { cambiarEtapaCtrl } from '@/lib/server/oportunidades-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST → mueve la oportunidad en el embudo y deja la fila ETAPA en su línea de
// tiempo, en la misma transacción. Perderla exige el motivo.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const o = await cambiarEtapaCtrl(g.usuario, params.id, await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Movió una oportunidad', `${o.nombre} · ${o.etapa}`)
    return NextResponse.json(o)
  } catch (e) {
    return respuestaError(e)
  }
}
