import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { ocupacionVallasCtrl } from '@/lib/server/vallas-controller'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/vallas/ocupacion?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
//   → { desde, hasta, ocupaciones: [{ sitioId, marca, campanaId, campanaNombre, inicio, fin }] }
// Para el plano de las vallas (20/11). Las reservas son por SITIO: cada fila
// dice qué campaña ocupa un sitio con vallas, y el plano la extiende a todos
// sus cuadros. Mismo criterio que `POST /api/vallas/verificar`.
export async function GET(req: Request) {
  const g = await exigir('inventario', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await ocupacionVallasCtrl(new URL(req.url).searchParams))
  } catch (e) {
    return respuestaError(e)
  }
}
