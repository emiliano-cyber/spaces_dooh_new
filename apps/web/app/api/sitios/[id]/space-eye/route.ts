import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { q1 } from '@/lib/server/db'
import { visionDeCodigo } from '@/lib/server/space-eye'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/sitios/[id]/space-eye → visión de la pantalla en Space Eye (cámara +
// IA): estado del dispositivo, última foto real y dictamen. El enlace es por
// codigo_proveedor == billboard_code. La lectura del sitio va con RLS (tenant de
// la sesión), así que solo devuelve la cámara de una pantalla del propio tenant.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const row = await q1<{ codigo_proveedor: string }>(
      'select codigo_proveedor from sitios where id = $1',
      [params.id],
    )
    if (!row) return NextResponse.json({ error: 'Pantalla no encontrada' }, { status: 404 })
    const vision = await visionDeCodigo(row.codigo_proveedor)
    return NextResponse.json(vision)
  } catch (e) {
    return respuestaError(e)
  }
}
