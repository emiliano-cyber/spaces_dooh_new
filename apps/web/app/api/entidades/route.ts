import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { crearEntidadCtrl } from '@/lib/server/entidades-controller'
import { listarEntidades } from '@/lib/server/entidades-repo'
import { catalogoRolesConEtiqueta } from '@/lib/server/bienvenida-repo'
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
    // El `catalogo` viaja con el listado porque la pantalla necesita las dos
    // cosas a la vez y pedirlas por separado son dos viajes para pintar una
    // tabla. Va CON su etiqueta y en el orden de la tabla (`orden`), no como una
    // lista escrita en el front.
    //
    // Los cinco papeles son FIJOS para toda la flota por decisión de Jochelo
    // del 2026-09-18 — pero fijos NO es quemados: siguen viviendo en
    // `catalogo_roles_entidad` a propósito, porque corregir una etiqueta,
    // cambiar el orden o añadir un sexto es un `insert` y no reconstruir la
    // imagen y actualizar cada instancia. Y la FK de `entidad_roles` es lo que
    // impide que entre un rol inventado.
    //
    // Se REUTILIZA `catalogoRolesConEtiqueta` en vez de escribir aquí la
    // consulta: este repositorio ya tuvo DOS catálogos de permisos —uno en una
    // migración y otro en el guion de aprovisionamiento— y ganaba el que
    // corriera último, sin error y sin aviso. Lo que impide que dos listas
    // divergan no es que hoy coincidan, es que solo exista una.
    const [entidades, catalogo] = await Promise.all([
      listarEntidades({ incluirInactivas }),
      catalogoRolesConEtiqueta(),
    ])
    return NextResponse.json({ entidades, catalogo })
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
