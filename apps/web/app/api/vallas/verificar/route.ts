import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { verificarVallasCtrl } from '@/lib/server/vallas-controller'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/vallas/verificar { marca, fechaInicio, fechaFin, vallaIds?, sitioIds?,
// excluirCampanaId? } → { hallazgos, bloquea }. Corre TODAS las reglas de
// `lib/vallas/reglas/` y solo informa: no reserva ni bloquea nada. Es el punto
// de enganche para propuestas y reservas mientras no se conecten (ver
// `lib/vallas/reglas/index.ts`).
export async function POST(req: Request) {
  const g = await exigir('inventario', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await verificarVallasCtrl(await req.json().catch(() => ({}))))
  } catch (e) {
    return respuestaError(e)
  }
}
