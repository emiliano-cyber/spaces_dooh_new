import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { registrarPagoCobranza } from '@/lib/server/finanzas-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { notificar } from '@/lib/server/notificaciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/cobranzas/:id/pagar { monto? } → registra pago/abono (finanzas.crear)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('finanzas', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => ({}))
  const c = await registrarPagoCobranza(params.id, body?.monto ?? null)
  if (!c) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  await registrarAccion(g.usuario, c.liquidado ? 'Registró pago (liquidado)' : 'Registró abono', c.folio ?? 'cobranza')
  await notificar({ tipo: 'PAGO', nivel: 'ok', titulo: c.liquidado ? 'Cobranza liquidada' : 'Abono registrado', detalle: c.folio ?? 'cobranza', link: '/demo/finanzas' })
  return NextResponse.json(c)
}
