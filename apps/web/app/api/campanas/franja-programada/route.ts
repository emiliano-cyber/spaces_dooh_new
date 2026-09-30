import { NextResponse } from 'next/server'
import { exigir, tienePermiso } from '@/lib/server/auth'
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
//  los toca. Leer pide `comercial.ver`.
//
//  ESCRIBIR pide `comercial.aprobar`, y no `comercial.crear` como el resto de
//  la gestión de una campaña. Decisión del dueño del 2026-09-30: «como la
//  franja es después de la creación de la campaña, puede solo gerente
//  comercial, directivo y dueño». `comercial.crear` lo tiene también el
//  VENDEDOR; `comercial.aprobar` lo tienen DUENO, ADMINISTRADOR (el ADR 0040
//  le da lo mismo que al Dueño), DIRECTOR_COMERCIAL y GERENTE_VENTAS. Se usa el
//  permiso que ya existe en vez de inventar uno: la matriz de Administración
//  sigue mandando, y no hace falta migración. La e2e §5 fija los cinco roles.
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
    // La pantalla lo necesita para no ofrecerle al VENDEDOR un botón que el PUT
    // le va a negar: se calcula aquí, con la MISMA regla que el PUT.
    const puedeProgramar = await tienePermiso(g.usuario.rol, 'comercial', 'aprobar')
    return NextResponse.json({ ...(await programacionCtrl({ campanaId })), puedeProgramar })
  } catch (e) {
    return respuestaError(e)
  }
}

// PUT → programa (o quita, con `franjaId: null`) UNA franja en VARIAS campañas,
// todo o nada. PUT y no POST: repetir la misma petición deja el mismo estado.
export async function PUT(req: Request) {
  const g = await exigir('comercial', 'aprobar')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const r = await asignarFranjaProgramadaCtrl(await req.json().catch(() => ({})))
    await registrarAccion(g.usuario, r.bitacora.accion, r.bitacora.entidad)
    return NextResponse.json({ franja: r.franja, campanas: r.campanas })
  } catch (e) {
    return respuestaError(e)
  }
}
