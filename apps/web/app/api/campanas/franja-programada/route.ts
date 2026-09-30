import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'
import {
  asignarFranjaProgramadaCtrl,
  programacionCtrl,
} from '@/lib/server/programacion-controller'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  /api/campanas/franja-programada — en qué franja SE TRANSMITE cada campaña.
//  PROG-01 · decisión del dueño del 2026-09-30.
// ----------------------------------------------------------------------------
//  NO ES UNA RUTA DE PRECIO, y por eso no va bajo `precios` ni pide
//  `exigirCambioSensible` como las de la rejilla. Programar no mueve un peso:
//  lo contratado vive en `reservas.franja_id` y en el snapshot, y esta ruta no
//  los toca. Es gestión de la campaña, y pide EXACTAMENTE lo que piden hoy las
//  demás rutas que gestionan una campaña (confirmar, extender, repartir
//  creativos, enviar al dominio): `comercial.crear`. Leer pide `comercial.ver`.
//
//  ⚠️ Decisión pendiente del dueño: si programar el horario debería ser un
//  permiso propio (p. ej. para que Operaciones programe sin poder vender). Hoy
//  no existe uno, y inventarlo aquí sería decidir por él.
//
//  El nombre de la ruta NO lleva «rejilla» a propósito:
//  `rbac-coherencia.test.ts` exige `precios` a todo lo que la lleve, y esto no
//  es el catálogo de precio.
// ============================================================================

// GET → el catálogo de franjas (con las dadas de baja, para nombrarlas) y las
// campañas con su franja programada, sus contratadas y los avisos ya
// calculados. `?campanaId=` la acota a una: la usa el detalle de la campaña.
//
// Devuelve nombres y horas de las franjas a quien tiene `comercial.ver` aunque
// no tenga `precios.ver`: el nombre «Prime · 06:00–10:00» no es un precio, y
// sin él no se puede elegir en qué horario sale una campaña.
export async function GET(req: Request) {
  const g = await exigir('comercial', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const campanaId = new URL(req.url).searchParams.get('campanaId')
    return NextResponse.json(await programacionCtrl({ campanaId }))
  } catch (e) {
    return respuestaError(e)
  }
}

// PUT → programa (o quita, con `franjaId: null`) UNA franja en VARIAS campañas,
// todo o nada. PUT y no POST: repetir la misma petición deja el mismo estado.
export async function PUT(req: Request) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const r = await asignarFranjaProgramadaCtrl(await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, r.bitacora.accion, r.bitacora.entidad)
    return NextResponse.json({ franja: r.franja, campanas: r.campanas })
  } catch (e) {
    return respuestaError(e)
  }
}
