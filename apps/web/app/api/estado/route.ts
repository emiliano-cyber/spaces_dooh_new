import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { listarSitios } from '@/lib/server/sitios-repo'
import {
  listarClientes,
  listarCampanas,
  listarReservas,
  listarCreatividades,
} from '@/lib/server/campanas-repo'
import { listarOT, listarEvidencias } from '@/lib/server/ot-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/estado → slices persistidas para hidratar el store del front.
export async function GET() {
  const g = await exigir()
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const [sitios, clientes, campanas, reservas, creatividades, ordenesTrabajo, evidencias] =
    await Promise.all([
      listarSitios(),
      listarClientes(),
      listarCampanas(),
      listarReservas(),
      listarCreatividades(),
      listarOT(),
      listarEvidencias(),
    ])
  return NextResponse.json({ sitios, clientes, campanas, reservas, creatividades, ordenesTrabajo, evidencias })
}
