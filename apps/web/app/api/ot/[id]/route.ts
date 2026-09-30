import { NextResponse } from 'next/server'
import { exigir, tienePermiso } from '@/lib/server/auth'
import { getOTcompleta } from '@/lib/server/ot-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/ot/:id → OT con sitio, campaña y evidencias (vista móvil standalone)
//
// `puedeEditar` (OT-CHECK-01) le dice a la pantalla si este usuario puede
// tachar el checklist, con el MISMO permiso que exige `PATCH …/checklist`. Va
// aquí y no en el contexto de sesión porque `/m/ot/[id]` vive fuera del shell y
// no tiene `SesionProvider`: allí `usePuede` diría siempre que no.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('operaciones', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const data = await getOTcompleta(params.id)
  if (!data) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  const puedeEditar = await tienePermiso(g.usuario.rol, 'operaciones', 'crear')
  return NextResponse.json({ ...data, puedeEditar })
}
