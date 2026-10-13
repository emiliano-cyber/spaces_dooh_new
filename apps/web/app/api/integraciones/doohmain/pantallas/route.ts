import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { listarPantallasDoohmain } from '@/lib/server/doohmain'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/integraciones/doohmain/pantallas → { habilitado, pantallas, error? }
// Los nombres de pantalla que la cuenta de DOOHmain del owner ve, para elegir en
// la ficha de cada pantalla. Mismo permiso que ver el inventario: es la ficha la
// que lo pide. Responde 200 aunque DOOHmain falle —lista vacía y el motivo—,
// porque en la ficha eso no es un error: el nombre se puede escribir a mano.
export async function GET() {
  const g = await exigir('inventario', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  return NextResponse.json(await listarPantallasDoohmain())
}
