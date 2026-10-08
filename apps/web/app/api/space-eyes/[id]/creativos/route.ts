import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { creativosDeEquipo, spaceEyeHabilitado } from '@/lib/server/space-eye'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  GET /api/space-eyes/:id/creativos — los anuncios que han pasado por la pantalla.
// ----------------------------------------------------------------------------
//  El teléfono reconoce cada anuncio de su pantalla sin gastar datos y solo sube
//  foto cuando aparece uno que no conocía. Esto es ese catálogo: cuándo apareció
//  cada uno, cuándo se vio por última vez y cuántas veces.
//
//  Mismo trato que las fallas: ruta propia, permiso de mirar, y el alcance lo
//  pone la llave.
// ============================================================================

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('inventario', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

  if (!spaceEyeHabilitado()) {
    return NextResponse.json({ error: 'La integración con Space Eye no está configurada' }, { status: 503 })
  }

  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Equipo inválido' }, { status: 400 })
  }

  try {
    const p = await creativosDeEquipo(id)
    if (!p) return NextResponse.json({ disponible: false })
    return NextResponse.json({ disponible: true, ...p })
  } catch (e) {
    return respuestaError(e)
  }
}
