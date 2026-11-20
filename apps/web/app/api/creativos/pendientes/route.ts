import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { pendientesDeCreativosCtrl } from '@/lib/server/pendientes-creativo-controller'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/creativos/pendientes → la «tarea 1» completa para la pantalla de
// Creativos (FLUJO-CREA, 20/11): por aprobar (con su origen: el cliente por la
// liga o nosotros), por mandar a impresión y por programar. Requiere
// comercial.ver, el mismo módulo de la pantalla (`lib/modulos.ts`).
export async function GET() {
  const g = await exigir('comercial', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await pendientesDeCreativosCtrl())
  } catch (e) {
    return respuestaError(e)
  }
}
