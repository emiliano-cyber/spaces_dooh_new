import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { repartirCreativosCtrl } from '@/lib/server/creativos-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/campanas/:id/creativos/repartir
//   { creatividadIds: string[], soloVacias?: boolean }
//
// Asigna los creativos elegidos a TODAS las pantallas digitales de la campaña
// de una vez, repartiendo los spots de cada pantalla entre ellos.
//
// Mismo permiso que la asignación de a una (`comercial.crear`): es la misma
// operación hecha en bloque, y pedir un permiso distinto para la versión rápida
// significaría que quien puede hacerlo doce veces a mano no puede hacerlo una
// vez bien.
//
// Queda en bitácora porque sobrescribe asignaciones que alguien pudo poner a
// mano. «Se borró lo que puse» sin nada que lo explique es justo el tipo de
// hueco que la auditoría marcó en A10.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const res = await repartirCreativosCtrl(params.id, await req.json().catch(() => ({})))
    await registrarAccion(
      g.usuario,
      'Repartió creativos en la campaña',
      `${res.asignadas} pantalla(s)`,
    )
    return NextResponse.json(res)
  } catch (e) {
    return respuestaError(e)
  }
}
