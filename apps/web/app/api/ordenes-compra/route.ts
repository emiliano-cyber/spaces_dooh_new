import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { crearOrdenCompra } from '@/lib/server/ordenes-compra-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { notificar } from '@/lib/server/notificaciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/ordenes-compra { campanaId, monto?, documentoUrl?, notas? }
// Registra la ODC del cliente y marca oc_recibida en la campaña.
export async function POST(req: Request) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => null)
  if (!body?.campanaId) return NextResponse.json({ error: 'Falta la campaña' }, { status: 400 })
  const odc = await crearOrdenCompra(body.campanaId, {
    monto: body.monto ?? null,
    documentoUrl: body.documentoUrl ?? null,
    notas: body.notas ?? null,
  })
  if (!odc) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
  await registrarAccion(g.usuario, 'Registró ODC del cliente', odc.folio)
  await notificar({ tipo: 'ODC', nivel: 'ok', titulo: 'ODC registrada', detalle: `${odc.folio} · ${odc.monto.toLocaleString('es-MX')}`, link: `/demo/campanas/${odc.campanaId}` })
  return NextResponse.json(odc, { status: 201 })
}
