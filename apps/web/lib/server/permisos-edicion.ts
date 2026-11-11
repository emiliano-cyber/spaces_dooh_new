import 'server-only'
import { qRaw } from './db'
import { AppError } from './errores'
import { ROLES_ASIGNABLES } from '@/lib/roles'

// ============================================================================
//  lib/server/permisos-edicion.ts — el Dueño cambia la matriz de permisos
//  desde Administración (PERMISOS-EDITABLES, decidido por el dueño el 11/11).
// ----------------------------------------------------------------------------
//  Hasta ese día la matriz solo se ENSEÑABA: la fijaban las migraciones y era
//  igual en todas las instalaciones. Ahora cada empresa la ajusta en la suya.
//
//  ─── Las guardas, y por qué cada una ─────────────────────────────────────
//  · Solo el DUEÑO. El Administrador ya puede casi todo; dejarle tocar la
//    matriz le dejaría darse a sí mismo —o a otro— lo que el Dueño no le dio.
//  · La columna del Dueño NO se toca: siempre lo tiene todo. Si se pudiera
//    quitar `administracion`, un clic dejaría la instalación sin nadie que
//    pueda devolverlo.
//  · Solo pares módulo/acción que EXISTEN, y el catálogo son las filas del
//    Dueño (las tiene todas). Un par inventado no abriría nada —ninguna ruta
//    lo pide— pero ensuciaría la tabla y la pantalla.
//  · Solo roles asignables: los retirados (COMERCIAL, CLIENTE) siguen en el
//    enum pero nadie debería ganar permisos con ellos.
//  · Con VARIAS organizaciones en el servidor (el PADRE, la DEMO) se rechaza.
//    `rol_permisos` no tiene `tenant_id`: es de TODO el servidor. Ahí el Dueño
//    de una organización cambiaría los permisos de las demás. En una instancia
//    soberana (una empresa, un servidor) no pasa.
//
//  Lo que la matriz NUNCA concede, aunque se marque: eliminar usuarios
//  (`puedeEliminarUsuarios`, lib/roles.ts) se comprueba en código.
//
//  `qRaw` es lo correcto: `rol_permisos` y `tenants` no tienen RLS (no es el
//  fallo R2).
// ============================================================================

export interface CambioPermiso {
  rol: string
  modulo: string
  accion: string
  permitido: boolean
}

const ROLES_EDITABLES = new Set<string>(ROLES_ASIGNABLES.map((r) => r.value).filter((r) => r !== 'DUENO'))

export async function cambiarPermiso(c: CambioPermiso, actor: { id: string; rol: string }): Promise<void> {
  if (actor.rol !== 'DUENO') throw new AppError('Solo el Dueño puede cambiar los permisos', 403)
  if (c.rol === 'DUENO') throw new AppError('Los permisos del Dueño no se cambian: siempre los tiene todos', 400)
  if (!ROLES_EDITABLES.has(c.rol)) throw new AppError('Ese rol no existe o ya no se usa', 400)
  if (typeof c.permitido !== 'boolean') throw new AppError('Falta decir si se concede o se quita', 400)

  const catalogo = await qRaw<{ modulo: string; accion: string }>(
    "select modulo, accion from rol_permisos where rol = 'DUENO'",
  )
  if (!catalogo.some((p) => p.modulo === c.modulo && p.accion === c.accion)) {
    throw new AppError('Ese módulo o esa acción no existen', 400)
  }

  const orgs = Number((await qRaw<{ n: number }>('select count(*)::int as n from tenants'))[0]?.n ?? 0)
  if (orgs > 1) {
    throw new AppError(
      'En este servidor hay varias organizaciones y los permisos son de todo el servidor: no se cambian desde aquí',
      409,
    )
  }

  if (c.permitido) {
    await qRaw(
      'insert into rol_permisos (rol, modulo, accion) values ($1, $2, $3) on conflict do nothing',
      [c.rol, c.modulo, c.accion],
    )
  } else {
    await qRaw('delete from rol_permisos where rol = $1 and modulo = $2 and accion = $3', [c.rol, c.modulo, c.accion])
  }
}
