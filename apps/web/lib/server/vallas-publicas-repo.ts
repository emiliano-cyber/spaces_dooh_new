import 'server-only'
import { qRaw1, qConTenant } from './db'

// ============================================================================
//  lib/server/vallas-publicas-repo.ts — MODEL del plano de vallas en la liga
//  pública de la propuesta (`/p/<token>`, dueño 20/11).
// ----------------------------------------------------------------------------
//  ⚠️ ZONA R2 · RUTA PÚBLICA, SIN SESIÓN. Mismo patrón que
//  `fotos-sitio-publico-repo.ts` y `obtenerPropuestaPublica`: el token
//  aleatorio ES la autorización. Postgres resuelve su tenant
//  (`propuesta_tenant_por_token`, la única llamada con `qRaw1`: es una función
//  `security definer` que no lee filas con RLS) y la consulta corre bajo
//  `qConTenant` con ESE tenant —no con `qRaw`, que en `vallas` (fail-closed,
//  `20261119_vallas_esqueleto.sql`) devolvería cero filas en silencio—, y aun
//  así cada tabla repite su `tenant_id = $2`: la segunda capa no admite
//  excepciones.
//
//  Solo las vallas ACTIVAS de los sitios que son renglón de ESA propuesta.
//  Qué NO se lee, a propósito: notas, reservas, campañas, marcas, clientes,
//  medidas del grupo. Lo que no se selecciona no se puede filtrar.
//
//  `sigue_fuera`: el grupo tiene vallas activas en un sitio que NO es de la
//  propuesta. Se calcula aquí y se devuelve como booleano: el otro sitio no
//  sale de la base.
// ============================================================================

export interface VallasDePropuestaLeidas {
  sitios: { id: string; nombre: string }[]
  vallas: {
    id: string
    sitioId: string
    numero: string
    cara: number | null
    ancho: number
    alto: number
    grupoId: string | null
    posicion: number | null
    dobla: string | null
  }[]
  grupos: { id: string; numero: string; nombre: string | null; modo: string; sigueFuera: boolean }[]
}

/** `null` si el token no es de ninguna propuesta. */
export async function leerVallasDePropuestaPorToken(token: string): Promise<VallasDePropuestaLeidas | null> {
  const t = await qRaw1<{ tenant: string | null }>('select propuesta_tenant_por_token($1) as tenant', [token])
  const tenantId = t?.tenant
  if (!tenantId) return null

  const filas = await qConTenant<{ sitios: any[] | null; vallas: any[] | null; grupos: any[] | null }>(
    tenantId,
    `with prop as (
       select p.id, p.tenant_id
         from propuestas p
        where p.token_publico = $1
          and p.tenant_id = $2
        limit 1
     ),
     sit as (
       select distinct s.id, s.nombre
         from prop
         join propuesta_items i on i.propuesta_id = prop.id and i.tenant_id = prop.tenant_id
         join sitios s on s.id = i.sitio_id and s.tenant_id = i.tenant_id
        where s.tenant_id = $2
     ),
     val as (
       select v.id, v.sitio_id, v.numero, v.cara, v.ancho_m, v.alto_m, v.grupo_id, v.posicion, v.dobla
         from vallas v
         join sit on sit.id = v.sitio_id
        where v.tenant_id = $2
          and v.activo
     ),
     gru as (
       select g.id, g.numero, g.nombre, g.modo,
              exists (
                select 1 from vallas o
                 where o.grupo_id = g.id
                   and o.tenant_id = $2
                   and o.activo
                   and o.sitio_id not in (select id from sit)
              ) as sigue_fuera
         from vallas_grupos g
        where g.tenant_id = $2
          and g.id in (select grupo_id from val where grupo_id is not null)
     )
     select (select count(*) from prop) as hay,
            (select json_agg(json_build_object('id', id, 'nombre', nombre) order by nombre) from sit) as sitios,
            (select json_agg(json_build_object(
                      'id', id, 'sitioId', sitio_id, 'numero', numero, 'cara', cara,
                      'ancho', ancho_m, 'alto', alto_m, 'grupoId', grupo_id,
                      'posicion', posicion, 'dobla', dobla) order by upper(numero)) from val) as vallas,
            (select json_agg(json_build_object(
                      'id', id, 'numero', numero, 'nombre', nombre, 'modo', modo,
                      'sigueFuera', sigue_fuera) order by upper(numero)) from gru) as grupos`,
    [token, tenantId],
  )
  const f = filas[0] as any
  if (!f || Number(f.hay) === 0) return null
  return {
    sitios: f.sitios ?? [],
    vallas: (f.vallas ?? []).map((v: any) => ({
      ...v,
      cara: v.cara == null ? null : Number(v.cara),
      ancho: Number(v.ancho),
      alto: Number(v.alto),
      posicion: v.posicion == null ? null : Number(v.posicion),
    })),
    grupos: f.grupos ?? [],
  }
}
