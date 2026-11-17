import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { conteoDiarioCtrl } from '@/lib/server/propuestas-conteo-controller'
import { respuestaError } from '@/lib/server/errores'

// CONTEO-DIA (17/11) · creadas y aprobadas por día y por vendedor. Lo ve quien
// ve Comercial; QUÉ ve (todos o solo lo suyo) lo decide el controller con la
// sesión, no un parámetro de esta URL.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const g = await exigir('comercial', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const sp = new URL(req.url).searchParams
    const query = Object.fromEntries([...sp.entries()].filter(([, v]) => v !== ''))
    return NextResponse.json(await conteoDiarioCtrl(g.usuario, query), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    return respuestaError(e)
  }
}
