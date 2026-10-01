import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { telemetriaDeEquipo, spaceEyeHabilitado } from '@/lib/server/space-eye'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  GET /api/space-eyes/:id/telemetria?horas=24 — el histórico del equipo.
// ----------------------------------------------------------------------------
//  Va en su propia ruta y NO dentro de la ficha porque es información
//  secundaria: la ficha tiene que pintar sin esperarla, y esto se pide solo
//  cuando alguien abre la tarjeta del histórico. Metido en la ficha, una semana
//  de telemetría retrasaría la foto, que es lo que la gente viene a ver.
//
//  El alcance lo pone la llave (el controlador de Space Eye comprueba el dueño y
//  contesta 404 por un equipo ajeno), y el permiso es el de mirar: `ver`.
// ============================================================================

const HORAS_PERMITIDAS = [24, 168, 720] as const

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('inventario', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

  if (!spaceEyeHabilitado()) {
    return NextResponse.json({ error: 'La integración con Space Eye no está configurada' }, { status: 503 })
  }

  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Equipo inválido' }, { status: 400 })
  }

  // Rangos cerrados a tres, y no un número libre: un `horas=100000` pediría
  // meses de histórico al tercero por cada recarga de pantalla.
  const pedidas = Number(new URL(req.url).searchParams.get('horas') ?? 24)
  const horas = (HORAS_PERMITIDAS as readonly number[]).includes(pedidas) ? pedidas : 24

  try {
    const t = await telemetriaDeEquipo(id, horas)
    if (!t) return NextResponse.json({ disponible: false, horas })
    return NextResponse.json({ disponible: true, horas, ...t })
  } catch (e) {
    return respuestaError(e)
  }
}
