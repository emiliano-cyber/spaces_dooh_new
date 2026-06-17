import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { listarSitios } from '@/lib/server/sitios-repo'
import {
  listarClientes,
  listarCampanas,
  listarReservas,
  listarCreatividades,
} from '@/lib/server/campanas-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/estado → slices persistidas para hidratar el store del front.
export async function GET() {
  const g = await exigir()
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const [sitios, clientes, campanas, reservas, creatividades] = await Promise.all([
    listarSitios(),
    listarClientes(),
    listarCampanas(),
    listarReservas(),
    listarCreatividades(),
  ])
  return NextResponse.json({ sitios, clientes, campanas, reservas, creatividades })
}
