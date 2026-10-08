import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { pantallaDeEquipo, spaceEyeHabilitado } from '@/lib/server/space-eye'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  GET /api/space-eyes/:id/fallas — lo que el equipo ve MAL en su pantalla.
// ----------------------------------------------------------------------------
//  Gabinetes apagados o congelados, pantalla apagada en horario, cámara movida:
//  el propio teléfono lo detecta mirando su pantalla (APK 0.15+) y avisa solo
//  cuando lo confirma y cuando se arregla, con foto de evidencia.
//
//  En su propia ruta, como la telemetría: la ficha pinta sin esperarla. El
//  alcance lo pone la llave (Space Eye comprueba el dueño y contesta 404 por un
//  equipo ajeno) y el permiso es el de mirar. Cerrar o descartar una falla NO se
//  hace desde aquí: es operación de Space Eye.
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
    const p = await pantallaDeEquipo(id)
    if (!p) return NextResponse.json({ disponible: false })
    return NextResponse.json({ disponible: true, ...p })
  } catch (e) {
    return respuestaError(e)
  }
}
