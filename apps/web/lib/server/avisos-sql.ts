// ============================================================================
//  lib/server/avisos-sql.ts — las sentencias de `avisos-repo.ts`, sueltas.
// ----------------------------------------------------------------------------
//  AVISOS-CANAL (12/11). Viven aparte, sin `server-only` ni conexión, para que
//  `avisos-canal.e2e.test.ts` corra contra Postgres real EXACTAMENTE las mismas
//  sentencias que la aplicación, con el rol `spaces_app` y la RLS puesta. Las
//  unitarias no ven la RLS: simulan la base (CLAUDE.md §3, R2).
// ============================================================================

/** $1 usuario · $2 tenant */
export const SQL_TELEFONO_PROPIO =
  'select telefono_whatsapp from usuarios where id = $1 and tenant_id = $2'

/** $1 usuario · $2 tenant */
export const SQL_AVISOS_PROPIOS =
  'select tipo, canal from avisos_usuario where usuario_id = $1 and tenant_id = $2 order by tipo, canal'

/**
 * $1 usuario · $2 tenant · $3 teléfono · $4 tipos[] · $5 canales[]
 *
 * Deja las preferencias EXACTAMENTE como vienen, en UNA sentencia: lo que
 * sobra se borra y lo que falta se inserta. Los dos conjuntos son disjuntos,
 * así que el `delete` y el `insert` del mismo CTE no se pisan. Todo cuelga de
 * `cuenta`: si la fila del usuario no se ve (otro tenant, RLS, borrado), no se
 * toca nada y no devuelve filas.
 */
export const SQL_GUARDAR_AVISOS = `
  with cuenta as (
    update usuarios set telefono_whatsapp = $3
     where id = $1 and tenant_id = $2
     returning id
  ),
  nuevos as (
    select t.tipo, t.canal
      from unnest($4::text[], $5::text[]) as t(tipo, canal)
  ),
  quitar as (
    delete from avisos_usuario a
     where a.usuario_id = $1 and a.tenant_id = $2
       and exists (select 1 from cuenta)
       and not exists (select 1 from nuevos n where n.tipo = a.tipo and n.canal = a.canal)
  ),
  poner as (
    insert into avisos_usuario (tenant_id, usuario_id, tipo, canal)
    select $2, c.id, n.tipo, n.canal from cuenta c cross join nuevos n
    on conflict (usuario_id, tipo, canal) do nothing
  )
  select id from cuenta`

/** $1 tenant · $2 tipo · $3 canal. Solo usuarios ACTIVOS. */
export const SQL_DESTINATARIOS = `
  select u.email, u.nombre, u.telefono_whatsapp as telefono
    from avisos_usuario a
    join usuarios u on u.id = a.usuario_id and u.tenant_id = a.tenant_id
   where a.tenant_id = $1 and a.tipo = $2 and a.canal = $3 and u.activo = true
   order by u.email`

/** $1 tenant */
export const SQL_IDENTIDAD_ORG = `
  select t.nombre, c.email_remitente, c.logo_token
    from tenants t left join config_negocio c on c.tenant_id = t.id
   where t.id = $1`
