import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { listarAbonosCtrl } from '@/lib/server/finanzas-controller'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/cobranzas/[id]/abonos → los pagos de una cobranza, con fecha, quién
// lo registró y si tiene comprobante. El archivo NO viaja aquí (COB-COMP): se
// pide por `abonos/[abonoId]/comprobante` cuando alguien lo abre.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('finanzas', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await listarAbonosCtrl(params.id))
  } catch (e) {
    return respuestaError(e)
  }
}
