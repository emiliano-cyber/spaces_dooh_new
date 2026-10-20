import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { adjuntarComprobanteCtrl } from '@/lib/server/finanzas-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/cobranzas/[id]/abonos/[abonoId] { comprobanteUrl } → adjunta o
// reemplaza el comprobante de un pago ya registrado (COB-COMP).
//
// `exigir` y no `exigirCambioSensible`, igual que los adjuntos de un pago de
// renta (`app/api/pagos-renta/[id]/route.ts`): no mueve dinero —el cuerpo solo
// admite el archivo— y el cobro ya pasó por el candado al registrarse.
export async function PATCH(req: Request, { params }: { params: { id: string; abonoId: string } }) {
  const g = await exigir('finanzas', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const r = await adjuntarComprobanteCtrl(params.id, params.abonoId, await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, 'Adjuntó comprobante de pago', r.folio ?? 'cobranza')
    return NextResponse.json({ ok: true })
  } catch (e) {
    return respuestaError(e)
  }
}
