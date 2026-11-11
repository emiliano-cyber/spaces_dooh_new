import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { camposOcultosPantalla } from '@/lib/server/campos-pantalla'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/instancia/campos-pantalla → { ocultos: [...] }   (CAMPOS-PANTALLA, 11/11)
//
// Los campos del alta de pantalla que ESTA instancia quitó al instalarse
// (`--ocultar-campos-pantalla` → `PANTALLA_CAMPOS_OCULTOS` en `app.env`). Lo
// lee el formulario «Nueva pantalla». Con sesión e `inventario.ver`: no es un
// secreto, pero tampoco hay motivo para contarlo a quien no ha entrado.
export async function GET() {
  const g = await exigir('inventario', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  return NextResponse.json({ ocultos: camposOcultosPantalla() }, { headers: { 'cache-control': 'no-store' } })
}
