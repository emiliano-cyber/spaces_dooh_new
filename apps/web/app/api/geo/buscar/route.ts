import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { respuestaError } from '@/lib/server/errores'
import { buscarDireccionCtrl } from '@/lib/server/negociacion-controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// NEG-01 · GET ?q= → candidatos de dirección con coordenadas, para ubicar un
// espacio. Va por el servidor (ritmo de 1/s del servicio, tope por persona,
// memoria) y solo para quien trabaja en Captación: `lib/server/geo-buscar.ts`.
export async function GET(req: Request) {
  const g = await exigir('captacion', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await buscarDireccionCtrl(g.usuario, new URL(req.url).searchParams))
  } catch (e) {
    return respuestaError(e)
  }
}
