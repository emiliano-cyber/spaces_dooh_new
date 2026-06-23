import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { estadoIntegraciones, metricasAdmobilize } from '@/lib/server/integraciones'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/integraciones            → estado de cada conector.
// GET /api/integraciones?admobilize=<deviceId> → métricas (simuladas) de prueba.
export async function GET(req: Request) {
  const g = await exigir('administracion', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const device = new URL(req.url).searchParams.get('admobilize')
  if (device != null) {
    return NextResponse.json(await metricasAdmobilize(device))
  }
  return NextResponse.json({ integraciones: estadoIntegraciones() })
}
