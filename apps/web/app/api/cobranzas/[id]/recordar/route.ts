import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { enviarRecordatorioCobranza } from '@/lib/server/finanzas-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/cobranzas/:id/recordar → envía un recordatorio de cobro manual
// (notificación in-app). Requiere permiso finanzas.crear.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('finanzas', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const res = await enviarRecordatorioCobranza(params.id)
  if (!res) return NextResponse.json({ error: 'Cobranza no encontrada' }, { status: 404 })
  if (!res.ok) return NextResponse.json({ error: res.motivo ?? 'No se pudo recordar' }, { status: 409 })
  await registrarAccion(g.usuario, 'Envió recordatorio de cobro', params.id)
  return NextResponse.json(res)
}
