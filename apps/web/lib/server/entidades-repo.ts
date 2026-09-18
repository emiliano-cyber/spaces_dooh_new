import 'server-only'
import { q, q1, withTenantTx } from './db'
import { tenantActual } from './tenant'
import type { PoolClient } from 'pg'

// ============================================================================
//  lib/server/entidades-repo.ts — Las razones sociales PROPIAS del owner.
// ----------------------------------------------------------------------------
//  Una empresa de DOOH reparte su operación entre varias razones sociales: una
//  paga las rentas, otra compra los activos, otra tramita las licencias, otra
//  vende. Esta es la capa de datos de ese catálogo.
//
//  NO CONFUNDIR con `arrendador_razon_social` (`arrendadores-repo.ts:691`), que
//  es la razón social del ARRENDADOR — quien me COBRA la renta. Esta es la del
//  owner, quien la PAGA. Aquella tabla no se toca desde aquí.
//
//  ─── `entidad_id` NO es una frontera de seguridad ────────────────────────
//  La frontera es UNA: `tenant_id` con RLS. Toda consulta de este archivo lleva
//  `and tenant_id = $n` explícito como SEGUNDA capa sobre la política, y usa
//  `q`/`q1` — nunca `qRaw`, que no fija el contexto de tenant. El motivo no es
//  ceremonia: el fallo R2 de este repositorio no da error, devuelve cero filas
//  en silencio o filas de otra empresa, y ya costó un despliegue entero.
//  `entidades-repo.test.ts` barre este archivo y se pone rojo si una consulta
//  nueva se olvida del tenant.
// ============================================================================

export interface EntidadFiscal {
  id: string
  razonSocial: string
  rfc: string | null
  regimen: string | null
  cpFiscal: string | null
  serieFolios: string | null
  activo: boolean
  creadoEn: string | null
  roles: string[]
}

const iso = (v: unknown): string | null =>
  v instanceof Date ? v.toISOString() : (v as string | null) ?? null

function filaAEntidad(r: any): EntidadFiscal {
  return {
    id: r.id,
    razonSocial: r.razon_social,
    rfc: r.rfc ?? null,
    regimen: r.regimen ?? null,
    cpFiscal: r.cp_fiscal ?? null,
    serieFolios: r.serie_folios ?? null,
    activo: r.activo,
    creadoEn: iso(r.creado_en),
    roles: r.roles ?? [],
  }
}

// Los roles viajan con la entidad en la MISMA consulta y no en una segunda por
// fila: el listado de Administración las pinta todas, y una consulta por
// entidad es el N+1 clásico. La subconsulta lleva su propio `tenant_id` — no se
// apoya en que el padre ya esté acotado.
const ROLES_DE_LA_FILA = `
  coalesce((select array_agg(r.rol order by r.rol)
              from entidad_roles r
             where r.entidad_id = e.id and r.tenant_id = $1), array[]::text[]) as roles`

// ─── Lectura ────────────────────────────────────────────────────────────────

// Por omisión SOLO las activas: una entidad dada de baja sigue en la base para
// sostener los documentos que la nombran, pero no es una opción que ofrecer al
// capturar. `incluirInactivas` existe para la pantalla que las administra.
export async function listarEntidades(
  opts?: { incluirInactivas?: boolean },
): Promise<EntidadFiscal[]> {
  const rows = await q(
    `select e.*, ${ROLES_DE_LA_FILA}
       from entidades_fiscales e
      where e.tenant_id = $1 and (e.activo or $2)
      order by e.razon_social asc`,
    [await tenantActual(), opts?.incluirInactivas ?? false],
  )
  return rows.map(filaAEntidad)
}

export async function obtenerEntidad(id: string): Promise<EntidadFiscal | null> {
  const r = await q1(
    `select e.*, ${ROLES_DE_LA_FILA}
       from entidades_fiscales e
      where e.id = $2 and e.tenant_id = $1`,
    [await tenantActual(), id],
  )
  return r ? filaAEntidad(r) : null
}

export async function rolesDeEntidad(id: string): Promise<string[]> {
  const rows = await q(
    'select rol from entidad_roles where entidad_id = $1 and tenant_id = $2 order by rol',
    [id, await tenantActual()],
  )
  return rows.map((r: any) => r.rol)
}

// El catálogo se lee de la BASE y no de una constante del código. Es la decisión
// de diseño del módulo: la lista de roles es una decisión de negocio todavía
// abierta, así que cambiarla tiene que ser un `insert` y no una migración con su
// despliegue detrás. No lleva `tenant_id`: es vocabulario del producto, igual
// para toda la flota.
export async function catalogoRolesEntidad(): Promise<string[]> {
  const rows = await q('select rol from catalogo_roles_entidad order by orden asc, rol asc')
  return rows.map((r: any) => r.rol)
}

// ─── Escritura ──────────────────────────────────────────────────────────────

async function rolesEnTx(
  client: PoolClient,
  id: string,
  tenantId: string | null,
): Promise<string[]> {
  const { rows } = await client.query(
    'select rol from entidad_roles where entidad_id = $1 and tenant_id = $2 order by rol',
    [id, tenantId],
  )
  return rows.map((r: any) => r.rol)
}

// Inserta los roles en UNA sentencia, desplegando el arreglo. Una sentencia por
// rol multiplicaría los viajes a la base sin ganar nada, y el `unnest` deja el
// `tenant_id` escrito una sola vez, que es donde se olvida.
async function fijarRolesEnTx(
  client: PoolClient,
  id: string,
  roles: string[],
  tenantId: string | null,
): Promise<void> {
  if (!roles.length) return
  await client.query(
    `insert into entidad_roles (entidad_id, rol, tenant_id)
     select $1, rol, $3 from unnest($2::text[]) as rol`,
    [id, roles, tenantId],
  )
}

export interface AltaEntidad {
  razonSocial: string
  rfc?: string | null
  regimen?: string | null
  cpFiscal?: string | null
  serieFolios?: string | null
  roles?: string[]
}

// El `tenant_id` sale de la SESIÓN, nunca del cuerpo de la petición: si entrara
// por ahí, cualquiera podría sembrar filas en la organización de otro.
//
// Entidad y roles van en la MISMA transacción. Si fueran dos llamadas sueltas y
// fallara la segunda, quedaría una razón social sin ningún papel: visible en la
// lista, inservible para todo, y sin nada que lo delatara.
export async function crearEntidad(input: AltaEntidad): Promise<EntidadFiscal> {
  const tenantId = await tenantActual()
  return withTenantTx(async (client) => {
    const { rows } = await client.query(
      `insert into entidades_fiscales
         (razon_social, rfc, regimen, cp_fiscal, serie_folios, tenant_id)
       values ($1,$2,$3,$4,$5,$6) returning *`,
      [
        input.razonSocial,
        input.rfc ?? null,
        input.regimen ?? null,
        input.cpFiscal ?? null,
        input.serieFolios ?? null,
        tenantId,
      ],
    )
    const creada = rows[0]
    await fijarRolesEnTx(client, creada.id, input.roles ?? [], tenantId)
    return { ...filaAEntidad(creada), roles: await rolesEnTx(client, creada.id, tenantId) }
  })
}

export interface ParcheEntidad {
  razonSocial?: string
  rfc?: string | null
  regimen?: string | null
  cpFiscal?: string | null
  serieFolios?: string | null
  roles?: string[]
  /** Reactivar una dada de baja: la baja es lógica y tiene vuelta. */
  activo?: boolean
}

// Solo toca lo que venga en `patch`: así se puede COMPLETAR un dato que faltaba
// —el RFC es el caso normal— sin reescribir los demás.
//
// Devuelve `null` cuando el `where` con `tenant_id` no encuentra nada, y eso
// incluye el caso «existe, pero es de otra organización». Quien llama lo
// convierte en 404: desde fuera las dos cosas tienen que ser indistinguibles.
export async function editarEntidad(
  id: string,
  patch: ParcheEntidad,
): Promise<EntidadFiscal | null> {
  const tenantId = await tenantActual()
  return withTenantTx(async (client) => {
    const columnas: [string, unknown][] = [
      ['razon_social', patch.razonSocial],
      ['rfc', patch.rfc],
      ['regimen', patch.regimen],
      ['cp_fiscal', patch.cpFiscal],
      ['serie_folios', patch.serieFolios],
      // Reactivar va por el MISMO camino que los demás campos, así que la
      // escritura sigue acotada por `and tenant_id = $n`: reactivar la entidad
      // de otra organización no encuentra fila y el controller lo convierte en
      // 404. Una ruta aparte para esto habría sido una segunda escritura donde
      // volver a olvidarse del tenant.
      ['activo', patch.activo],
    ]
    const dadas = columnas.filter(([, v]) => v !== undefined)

    let fila: any
    if (dadas.length) {
      const sets = dadas.map(([c], i) => `${c} = $${i + 1}`)
      const vals = [...dadas.map(([, v]) => v), id, tenantId]
      const { rows } = await client.query(
        `update entidades_fiscales set ${sets.join(', ')}
          where id = $${vals.length - 1} and tenant_id = $${vals.length} returning *`,
        vals,
      )
      fila = rows[0]
    } else {
      // Puede venir solo `roles`. Se lee igual acotado por tenant, para poder
      // distinguir «no existe» de «existe y no se cambió nada».
      const { rows } = await client.query(
        'select * from entidades_fiscales where id = $1 and tenant_id = $2',
        [id, tenantId],
      )
      fila = rows[0]
    }
    if (!fila) return null

    if (patch.roles) {
      // Los roles se REEMPLAZAN en bloque, no se añaden: la pantalla manda el
      // conjunto completo, y un `insert` a secas dejaría imposible quitar uno.
      await client.query('delete from entidad_roles where entidad_id = $1 and tenant_id = $2', [
        id,
        tenantId,
      ])
      await fijarRolesEnTx(client, id, patch.roles, tenantId)
    }
    return { ...filaAEntidad(fila), roles: await rolesEnTx(client, id, tenantId) }
  })
}

// Baja LÓGICA. No es un atajo: la entidad aparece en contratos y en comprobantes
// ya emitidos, y las FK son `on delete set null`, así que un `delete` no
// fallaría — dejaría esos documentos sin razón social en silencio, que es peor
// que un error. Se apaga y deja de ofrecerse al capturar.
export async function desactivarEntidad(id: string): Promise<boolean> {
  const rows = await q(
    `update entidades_fiscales set activo = false
      where id = $1 and tenant_id = $2 returning id`,
    [id, await tenantActual()],
  )
  return rows.length > 0
}
