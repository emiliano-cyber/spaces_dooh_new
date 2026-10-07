import { NextResponse } from 'next/server'
import { exigir, tienePermiso } from '@/lib/server/auth'
import { resumenPropuestasCtrl } from '@/lib/server/propuestas-resumen-controller'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/propuestas/resumen?periodo=mes|mes-anterior|trimestre|trimestre-anterior|anio|rango[&desde&hasta]
// El tablero de propuestas por periodo (PROP-PER, 06/10): generadas, aprobadas,
// rechazadas, tasa de cierre y, con `finanzas.ver`, la ganancia (venta − renta).
// Abrirlo pide `comercial.ver`, el mismo permiso que la lista de propuestas; el
// costo y la ganancia solo viajan a quien puede ver finanzas.
export async function GET(req: Request) {
  const g = await exigir('comercial', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const sp = new URL(req.url).searchParams
    const query = Object.fromEntries([...sp.entries()].filter(([, v]) => v !== ''))
    const conGanancia = await tienePermiso(g.usuario.rol, 'finanzas', 'ver')
    return NextResponse.json(await resumenPropuestasCtrl(query, conGanancia), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    return respuestaError(e)
  }
}
