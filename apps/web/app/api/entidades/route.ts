import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { crearEntidadCtrl } from '@/lib/server/entidades-controller'
import { listarEntidades } from '@/lib/server/entidades-repo'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  /api/entidades — las razones sociales PROPIAS del owner.
// ----------------------------------------------------------------------------
//  Permiso `administracion` y no `arrendadores`: esto es la identidad fiscal del
//  negocio —a nombre de quién paga y factura—, no un dato operativo del módulo
//  de propietarios. Quien captura contratos no decide con qué sociedad se firma.
//
//  Cuidado con la confusión que ya vive en el repositorio:
//  `/api/razones-sociales` es la razón social del ARRENDADOR, quien me COBRA la
//  renta. Esta ruta es la del owner, quien la PAGA.
// ============================================================================

// GET /api/entidades → las entidades de la organización, con sus roles.
//
// `?inactivas=1` incluye las dadas de baja: la pantalla que las administra
// necesita verlas para poder reactivarlas, y el resto de la aplicación no.
export async function GET(req: Request) {
  const g = await exigir('administracion', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const incluirInactivas = new URL(req.url).searchParams.get('inactivas') === '1'
    return NextResponse.json({ entidades: await listarEntidades({ incluirInactivas }) })
  } catch (e) {
    return respuestaError(e)
  }
}

// POST /api/entidades → alta de una razón social propia.
export async function POST(req: Request) {
  const g = await exigir('administracion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const entidad = await crearEntidadCtrl(await req.json().catch(() => ({})))
    // La bitácora nombra los roles, no solo la razón social: el papel es la
    // parte que decide qué documentos salen a nombre de esta entidad, y quien
    // revise después necesita ver con qué nació.
    await registrarAccion(
      g.usuario,
      entidad.roles.length
        ? `Creó entidad fiscal (${entidad.roles.join(', ')})`
        : 'Creó entidad fiscal',
      entidad.razonSocial,
    )
    return NextResponse.json(entidad, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
