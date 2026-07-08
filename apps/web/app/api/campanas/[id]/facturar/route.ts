import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { generarFacturaCtrl } from '@/lib/server/finanzas-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { notificar } from '@/lib/server/notificaciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/campanas/:id/facturar  { plazoDias } (requiere finanzas.facturar)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('finanzas', 'facturar')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const factura = await generarFacturaCtrl(params.id, await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Generó factura', factura.folio)
    await notificar({ tipo: 'FACTURA', nivel: 'ok', titulo: 'Factura emitida', detalle: `${factura.folio} · ${factura.monto.toLocaleString('es-MX')}`, link: '/demo/finanzas' })
    return NextResponse.json(factura, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
