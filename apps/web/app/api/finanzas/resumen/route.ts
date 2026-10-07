import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { resumenFinanzasCtrl } from '@/lib/server/finanzas-controller'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/finanzas/resumen?periodo=mes|mes-anterior|trimestre|trimestre-anterior|anio|rango
//                          [&desde=AAAA-MM-DD&hasta=AAAA-MM-DD][&cliente=<uuid>]
// El tablero de Finanzas por periodo y el estado de cuenta (de la empresa, o de
// un cliente con `cliente`). Solo lectura, con `finanzas.ver`: es el mismo
// permiso que abre la pantalla. Las definiciones de cada cifra están en
// `lib/finanzas-periodo.ts` (ADR 0046).
export async function GET(req: Request) {
  const g = await exigir('finanzas', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const sp = new URL(req.url).searchParams
    const query = Object.fromEntries([...sp.entries()].filter(([, v]) => v !== ''))
    return NextResponse.json(await resumenFinanzasCtrl(query), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return respuestaError(e)
  }
}
