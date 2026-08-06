import 'server-only'
import { qRaw1, qConTenant } from './db'

// ============================================================================
//  lib/server/identidades-repo.ts — ADR 0012 · vinculación con proveedores
//  externos (hoy solo Google).
//
//  Dos capas, como el resto del repo:
//
//   · LECTURA pre-sesión → función SECURITY DEFINER. Cuando llega el callback
//     todavía no sabemos de qué organización es quien entra, y tanto `usuarios`
//     como `identidades_externas` son fail-closed + FORCE: una consulta directa
//     devolvería CERO filas y el usuario vería «esa cuenta no está dada de
//     alta» sin que nada fallara. Es el modo de fallo exacto que dejó
//     `desbloquear()` inservible un despliegue entero (43f9284).
//
//   · ESCRITURA → `qConTenant` con el tenant YA resuelto, más el filtro
//     explícito por `tenant_id` además de la RLS. Las dos capas que el repo se
//     exige.
// ============================================================================

export const PROVEEDOR_GOOGLE = 'google'

export interface UsuarioDeIdentidad {
  id: string
  nombre: string
  email: string
  cargo: string | null
  rol: string
  activo: boolean
  tenant_id: string
}

// (proveedor, sub) → usuario. null si esa identidad no está vinculada a nadie.
export async function usuarioPorIdentidad(
  proveedor: string,
  sub: string,
): Promise<UsuarioDeIdentidad | null> {
  return qRaw1<UsuarioDeIdentidad>(
    `select id, nombre, email, cargo, rol, activo, tenant_id
       from auth_usuario_por_identidad($1, $2)`,
    [proveedor, sub],
  )
}

// Graba el vínculo la PRIMERA vez. Se llama solo tras haber resuelto al usuario
// por correo, así que el tenant es el suyo y no algo que dijera Google.
//
// `on conflict do nothing` en vez de `do update`: si esa identidad ya estuviera
// vinculada a OTRO usuario, pisarla sería mover el acceso de una cuenta a otra
// desde una ruta pública.
//
// DEVUELVE SI DE VERDAD INSERTÓ, y el llamador tiene que mirarlo. Sin `returning`
// esta función no distingue «vinculado» de «no se hizo nada», y el callback
// dejaría entrar a alguien sin vínculo grabado: la vez siguiente volvería a
// decidirse por correo, y sin rastro en la bitácora del primer acceso. Dos
// conflictos posibles, los dos silenciosos:
//
//   · (proveedor, sub) ya existe — esa cuenta de Google es de otro usuario;
//   · (proveedor, usuario_id) ya existe — ese usuario ya tiene otra cuenta de
//     Google vinculada.
export async function vincularIdentidad(opts: {
  proveedor: string
  sub: string
  usuarioId: string
  tenantId: string
  emailExterno: string
}): Promise<boolean> {
  const filas = await qConTenant<{ sub: string }>(
    opts.tenantId,
    `insert into identidades_externas (proveedor, sub, usuario_id, tenant_id, email_externo, ultimo_uso_en)
     values ($1,$2,$3,$4,$5, now())
     on conflict do nothing
     returning sub`,
    [opts.proveedor, opts.sub, opts.usuarioId, opts.tenantId, opts.emailExterno],
  )
  return filas.length > 0
}

// Sella el uso. No es crítico: si falla, el acceso ya ocurrió.
export async function marcarUso(proveedor: string, sub: string, tenantId: string): Promise<void> {
  try {
    await qConTenant(
      tenantId,
      `update identidades_externas set ultimo_uso_en = now()
        where proveedor = $1 and sub = $2 and tenant_id = $3`,
      [proveedor, sub, tenantId],
    )
  } catch {
    /* el sello de uso nunca rompe el acceso */
  }
}

// Registra el PRIMER vínculo en la bitácora.
//
// Se escribe a mano en vez de reusar `registrarAccion()`, y no es por gusto:
// aquélla resuelve el tenant con `tenantActual()`, que lo saca de la cookie de
// sesión — y aquí la sesión todavía NO existe (se crea después, en la misma
// respuesta). Reusarla dejaría el registro sin escribir, en silencio, que es
// justo lo que no se quiere del evento que delata una toma de cuenta.
//
// Se registra el primer vínculo y NO los accesos posteriores: es el evento que,
// ocurrido sin que el titular lo sepa, indica que alguien tomó la cuenta. Los
// inicios de sesión siguientes no aportan lo mismo y ahogarían la bitácora.
export async function registrarVinculo(opts: {
  usuarioId: string
  usuarioNombre: string
  tenantId: string
  emailExterno: string
}): Promise<void> {
  try {
    await qConTenant(
      opts.tenantId,
      `insert into acciones (accion, entidad, usuario_id, usuario_nombre, tenant_id)
       values ($1,$2,$3,$4,$5)`,
      [
        'Vinculó su cuenta de Google',
        opts.emailExterno,
        opts.usuarioId,
        opts.usuarioNombre,
        opts.tenantId,
      ],
    )
  } catch {
    /* la bitácora nunca rompe la operación principal */
  }
}
