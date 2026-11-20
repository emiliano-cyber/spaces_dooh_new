import 'server-only'
import type { PoolClient } from 'pg'
import { q, q1, withTenantTx } from './db'
import { tenantActual } from './tenant'
import { normalizarNumero } from '@/lib/vallas/numeracion'
import { normalizarMarca } from '@/lib/vallas/reglas/competencia-marcas'
import type { Valla, GrupoVallas, CategoriaCompetencia, Ocupacion, ModoGrupo } from '@/lib/vallas/tipos'
import { CATEGORIAS_COMPETENCIA_POR_OMISION } from '@/lib/vallas/competencia-por-omision'
import type { ContextoVallas, Candidata } from '@/lib/vallas/reglas'
import type { OcupacionSitio } from '@/lib/vallas/plano'

// ============================================================================
//  lib/server/vallas-repo.ts — VALLAS (esqueleto, 19/11).
// ----------------------------------------------------------------------------
//  Vallas, grupos de vallas y categorías de competencia. Cada consulta lleva
//  `tenant_id = $n` además de la RLS (segunda capa), y las FK son compuestas
//  `(x_id, tenant_id)` (ver `20261119_vallas_esqueleto.sql`).
//
//  `contextoParaVerificar` arma lo que necesitan las reglas
//  (`lib/vallas/reglas/`). Las ocupaciones salen de las RESERVAS, que hoy son
//  por SITIO: una reserva viva en un sitio ocupa TODAS sus vallas. Es la
//  aproximación honesta mientras la reserva no sepa en qué cuadro cae.
// ============================================================================

export class VallaError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message)
  }
}

export const VALLA_NO_ENCONTRADA = 'Valla no encontrada'
export const VALLA_DUPLICADA = 'Ya existe una valla con ese número'
export const GRUPO_NO_ENCONTRADO = 'Grupo de vallas no encontrado'
export const GRUPO_DUPLICADO = 'Ya existe un grupo de vallas con ese número'
export const SITIO_AJENO = 'Ese sitio no es de tu organización'
export const VALLAS_AJENAS = 'Alguna de esas vallas no es de tu organización'
export const CATEGORIA_NO_ENCONTRADA = 'Categoría de competencia no encontrada'
export const CATEGORIA_DUPLICADA = 'Ya existe una categoría de competencia con ese nombre'
/** Decisión del dueño (19/11): el catálogo de competencia es del Dueño. */
export const SOLO_DUENO_COMPETENCIA = 'Solo el Dueño puede editar las marcas que compiten'

const num = (x: unknown): number | null => (x == null ? null : Number(x))

export function rowToValla(r: any): Valla {
  return {
    id: r.id,
    sitioId: r.sitio_id,
    numero: r.numero,
    cara: r.cara ?? null,
    ancho: Number(r.ancho_m),
    alto: Number(r.alto_m),
    grupoId: r.grupo_id ?? null,
    posicion: r.posicion ?? null,
    notas: r.notas ?? null,
    activo: r.activo !== false,
  }
}

export function rowToGrupo(r: any): GrupoVallas {
  return {
    id: r.id,
    numero: r.numero,
    nombre: r.nombre ?? null,
    modo: r.modo as ModoGrupo,
    ancho: num(r.ancho_m),
    alto: num(r.alto_m),
    notas: r.notas ?? null,
    activo: r.activo !== false,
  }
}

export function rowToCategoria(r: any): CategoriaCompetencia {
  return { id: r.id, nombre: r.nombre, marcas: r.marcas ?? [], activo: r.activo !== false }
}

const esDuplicado = (e: unknown) => (e as { code?: string })?.code === '23505'
const esFkRota = (e: unknown) => (e as { code?: string })?.code === '23503'

// ─── Vallas ────────────────────────────────────────────────────────────────

export async function listarVallasYGrupos(): Promise<{ vallas: Valla[]; grupos: GrupoVallas[] }> {
  const t = await tenantActual()
  const [vallas, grupos] = await Promise.all([
    q('select * from vallas where tenant_id = $1 order by upper(numero) asc', [t]),
    q('select * from vallas_grupos where tenant_id = $1 order by upper(numero) asc', [t]),
  ])
  return { vallas: vallas.map(rowToValla), grupos: grupos.map(rowToGrupo) }
}

async function sitioEsMio(sitioId: string): Promise<boolean> {
  const r = await q1<{ si: boolean }>('select exists (select 1 from sitios where id = $1 and tenant_id = $2) as si', [
    sitioId,
    await tenantActual(),
  ])
  return r?.si === true
}

export type DatosValla = {
  sitioId: string
  numero: string
  ancho: number
  alto: number
  cara?: number | null
  notas?: string | null
  activo?: boolean
}

export async function crearValla(d: DatosValla): Promise<Valla> {
  if (!(await sitioEsMio(d.sitioId))) throw new VallaError(SITIO_AJENO, 400)
  try {
    const rows = await q(
      `insert into vallas (tenant_id, sitio_id, numero, ancho_m, alto_m, cara, notas)
       values ($1,$2,$3,$4,$5,$6,$7) returning *`,
      [await tenantActual(), d.sitioId, normalizarNumero(d.numero), d.ancho, d.alto, d.cara ?? null, d.notas ?? null],
    )
    return rowToValla(rows[0])
  } catch (e) {
    if (esDuplicado(e)) throw new VallaError(VALLA_DUPLICADA)
    if (esFkRota(e)) throw new VallaError(SITIO_AJENO, 400)
    throw e
  }
}

export async function actualizarValla(id: string, d: Partial<DatosValla>): Promise<Valla | null> {
  if (d.sitioId !== undefined && !(await sitioEsMio(d.sitioId))) throw new VallaError(SITIO_AJENO, 400)
  const cols: [keyof DatosValla, string, (v: any) => unknown][] = [
    ['sitioId', 'sitio_id', (v) => v],
    ['numero', 'numero', (v) => normalizarNumero(v)],
    ['ancho', 'ancho_m', (v) => v],
    ['alto', 'alto_m', (v) => v],
    ['cara', 'cara', (v) => v],
    ['notas', 'notas', (v) => v],
    ['activo', 'activo', (v) => v],
  ]
  const vals: unknown[] = [id, await tenantActual()]
  const sets: string[] = []
  for (const [k, col, f] of cols) {
    if (d[k] === undefined) continue
    vals.push(f(d[k]))
    sets.push(`${col} = $${vals.length}`)
  }
  try {
    const rows = sets.length
      ? await q(`update vallas set ${sets.join(', ')} where id = $1 and tenant_id = $2 returning *`, vals)
      : await q('select * from vallas where id = $1 and tenant_id = $2', vals)
    return rows[0] ? rowToValla(rows[0]) : null
  } catch (e) {
    if (esDuplicado(e)) throw new VallaError(VALLA_DUPLICADA)
    if (esFkRota(e)) throw new VallaError(SITIO_AJENO, 400)
    throw e
  }
}

export async function borrarValla(id: string): Promise<boolean> {
  const rows = await q('delete from vallas where id = $1 and tenant_id = $2 returning id', [id, await tenantActual()])
  return rows.length > 0
}

// ─── Grupos ────────────────────────────────────────────────────────────────

export type DatosGrupo = {
  numero: string
  nombre?: string | null
  modo: ModoGrupo
  ancho?: number | null
  alto?: number | null
  notas?: string | null
  activo?: boolean
  vallaIds?: string[]
}

/** Deja en el grupo EXACTAMENTE estas vallas, en este orden. */
async function fijarMiembros(c: PoolClient, tenant: string | null, grupoId: string, vallaIds: string[]) {
  const unicas = [...new Set(vallaIds)]
  if (unicas.length) {
    const mias = await c.query('select id from vallas where tenant_id = $1 and id = any($2::uuid[])', [tenant, unicas])
    if (mias.rowCount !== unicas.length) throw new VallaError(VALLAS_AJENAS, 400)
  }
  await c.query(
    `update vallas set grupo_id = null, posicion = null
      where tenant_id = $1 and grupo_id = $2 and not (id = any($3::uuid[]))`,
    [tenant, grupoId, unicas],
  )
  for (const [i, vid] of unicas.entries()) {
    await c.query('update vallas set grupo_id = $3, posicion = $4 where id = $1 and tenant_id = $2', [vid, tenant, grupoId, i + 1])
  }
}

export async function crearGrupo(d: DatosGrupo): Promise<GrupoVallas> {
  const tenant = await tenantActual()
  try {
    return await withTenantTx(async (c) => {
      const r = await c.query(
        `insert into vallas_grupos (tenant_id, numero, nombre, modo, ancho_m, alto_m, notas)
         values ($1,$2,$3,$4,$5,$6,$7) returning *`,
        [tenant, normalizarNumero(d.numero), d.nombre ?? null, d.modo, d.ancho ?? null, d.alto ?? null, d.notas ?? null],
      )
      if (d.vallaIds) await fijarMiembros(c, tenant, r.rows[0].id, d.vallaIds)
      return rowToGrupo(r.rows[0])
    })
  } catch (e) {
    if (esDuplicado(e)) throw new VallaError(GRUPO_DUPLICADO)
    throw e
  }
}

export async function actualizarGrupo(id: string, d: Partial<DatosGrupo>): Promise<GrupoVallas | null> {
  const tenant = await tenantActual()
  const cols: [keyof DatosGrupo, string, (v: any) => unknown][] = [
    ['numero', 'numero', (v) => normalizarNumero(v)],
    ['nombre', 'nombre', (v) => v],
    ['modo', 'modo', (v) => v],
    ['ancho', 'ancho_m', (v) => v],
    ['alto', 'alto_m', (v) => v],
    ['notas', 'notas', (v) => v],
    ['activo', 'activo', (v) => v],
  ]
  try {
    return await withTenantTx(async (c) => {
      const vals: unknown[] = [id, tenant]
      const sets: string[] = []
      for (const [k, col, f] of cols) {
        if (d[k] === undefined) continue
        vals.push(f(d[k]))
        sets.push(`${col} = $${vals.length}`)
      }
      const r = sets.length
        ? await c.query(`update vallas_grupos set ${sets.join(', ')} where id = $1 and tenant_id = $2 returning *`, vals)
        : await c.query('select * from vallas_grupos where id = $1 and tenant_id = $2', vals)
      if (!r.rows[0]) return null
      if (d.vallaIds) await fijarMiembros(c, tenant, id, d.vallaIds)
      return rowToGrupo(r.rows[0])
    })
  } catch (e) {
    if (esDuplicado(e)) throw new VallaError(GRUPO_DUPLICADO)
    throw e
  }
}

/** Borra el grupo; sus vallas quedan sueltas (en la misma transacción). */
export async function borrarGrupo(id: string): Promise<boolean> {
  const tenant = await tenantActual()
  return withTenantTx(async (c) => {
    await c.query('update vallas set grupo_id = null, posicion = null where tenant_id = $1 and grupo_id = $2', [tenant, id])
    const r = await c.query('delete from vallas_grupos where id = $1 and tenant_id = $2 returning id', [id, tenant])
    return (r.rowCount ?? 0) > 0
  })
}

// ─── Categorías de competencia ─────────────────────────────────────────────

/** Recorta y quita repetidas (comparando normalizado), conservando la primera. */
export function limpiarMarcas(marcas: string[]): string[] {
  const vistas = new Set<string>()
  const out: string[] = []
  for (const m of marcas) {
    const t = m.trim().replace(/\s+/g, ' ')
    const n = normalizarMarca(t)
    if (!n || vistas.has(n)) continue
    vistas.add(n)
    out.push(t)
  }
  return out
}

/**
 * Siembra en una organización las categorías de competencia por omisión
 * (`lib/vallas/competencia-por-omision.ts`, decisión del dueño del 19/11).
 *
 * La llama el ALTA (`crearOrgConDueno`) con SU cliente de transacción y con
 * `app.tenant_id` ya fijado al tenant nuevo: si el alta se deshace, las
 * categorías se van con ella, y la RLS forzada de la tabla deja insertar
 * porque el tenant coincide. Recibe el `tenantId` explícito por eso mismo:
 * dentro del alta `tenantActual()` sería el de quien da de alta, no el nuevo.
 *
 * `on conflict do nothing`: una categoría con el mismo nombre se respeta.
 * Las organizaciones que ya existían las reciben por la migración
 * `20261119_vallas_sembrar_competencia_por_omision.sql`.
 */
export async function sembrarCompetenciaPorOmision(c: PoolClient, tenantId: string): Promise<void> {
  const nombres = CATEGORIAS_COMPETENCIA_POR_OMISION.map((k) => k.nombre)
  // Las marcas viajan como JSON: un `text[][]` exige que todas las filas midan
  // lo mismo, y aquí cada categoría trae un número distinto de marcas.
  const marcas = CATEGORIAS_COMPETENCIA_POR_OMISION.map((k) => JSON.stringify(k.marcas))
  await c.query(
    `insert into competencia_categorias (tenant_id, nombre, marcas)
     select $1, v.nombre, array(select e from jsonb_array_elements_text(v.marcas::jsonb) with ordinality as x(e, i) order by x.i)
       from unnest($2::text[], $3::text[]) with ordinality as v(nombre, marcas, orden)
      order by v.orden
     on conflict do nothing`,
    [tenantId, nombres, marcas],
  )
}

export async function listarCategorias(): Promise<CategoriaCompetencia[]> {
  const rows = await q(
    'select * from competencia_categorias where tenant_id = $1 order by activo desc, lower(nombre) asc',
    [await tenantActual()],
  )
  return rows.map(rowToCategoria)
}

export async function crearCategoria(d: { nombre: string; marcas: string[] }): Promise<CategoriaCompetencia> {
  try {
    const rows = await q(
      'insert into competencia_categorias (tenant_id, nombre, marcas) values ($1,$2,$3::text[]) returning *',
      [await tenantActual(), d.nombre.trim(), limpiarMarcas(d.marcas)],
    )
    return rowToCategoria(rows[0])
  } catch (e) {
    if (esDuplicado(e)) throw new VallaError(CATEGORIA_DUPLICADA)
    throw e
  }
}

export async function actualizarCategoria(
  id: string,
  d: { nombre?: string; marcas?: string[]; activo?: boolean },
): Promise<CategoriaCompetencia | null> {
  const vals: unknown[] = [id, await tenantActual()]
  const sets: string[] = []
  if (d.nombre !== undefined) {
    vals.push(d.nombre.trim())
    sets.push(`nombre = $${vals.length}`)
  }
  if (d.marcas !== undefined) {
    vals.push(limpiarMarcas(d.marcas))
    sets.push(`marcas = $${vals.length}::text[]`)
  }
  if (d.activo !== undefined) {
    vals.push(d.activo)
    sets.push(`activo = $${vals.length}`)
  }
  try {
    const rows = sets.length
      ? await q(`update competencia_categorias set ${sets.join(', ')} where id = $1 and tenant_id = $2 returning *`, vals)
      : await q('select * from competencia_categorias where id = $1 and tenant_id = $2', vals)
    return rows[0] ? rowToCategoria(rows[0]) : null
  } catch (e) {
    if (esDuplicado(e)) throw new VallaError(CATEGORIA_DUPLICADA)
    throw e
  }
}

// ─── Contexto para las reglas ──────────────────────────────────────────────

type ReservaViva = { sitio_id: string; inicio: string; fin: string; campana_id: string; campana: string; marca: string | null }

/**
 * LAS reservas vivas que ocupan vallas: el criterio ÚNICO que comparten las
 * reglas (`contextoParaVerificar`) y el plano (`ocupacionDeVallas`), para que
 * «Verificar una marca» y el dibujo no puedan contar distinto.
 *
 * Viva = no cancelada, y si es tentativa, sin caducar. Solape INCLUSIVO
 * (tocarse un día ya ocupa). Solo sitios con alguna valla activa: las
 * reservas son por SITIO, y un sitio sin vallas no tiene nada que ocupar.
 * Una sola consulta para toda la organización, no una por sitio.
 */
async function reservasVivasEnSitiosConVallas(tenant: string | null, inicio: string, fin: string): Promise<ReservaViva[]> {
  return q<ReservaViva>(
    `select r.sitio_id, r.fecha_inicio::text as inicio, r.fecha_fin::text as fin,
            c.id as campana_id, c.nombre as campana,
            coalesce(nullif(btrim(c.marca), ''), cl.nombre) as marca
       from reservas r
       join campanas c on c.id = r.campana_id and c.tenant_id = $1
       left join clientes cl on cl.id = c.cliente_id and cl.tenant_id = $1
      where r.tenant_id = $1
        and r.sitio_id in (select v.sitio_id from vallas v where v.tenant_id = $1 and v.activo)
        and r.estatus <> 'CANCELADA'
        and (r.estatus <> 'TENTATIVA' or r.expira_en is null or r.expira_en > now())
        and r.fecha_inicio <= $3::date and r.fecha_fin >= $2::date
      order by r.fecha_inicio asc, c.nombre asc, c.id asc`,
    [tenant, inicio, fin],
  )
}

/**
 * Para el plano (`GET /api/vallas/ocupacion`): qué campañas ocupan cada sitio
 * con vallas entre `desde` y `hasta`. Se devuelve por SITIO, no por valla,
 * porque es lo que la reserva sabe hoy; el plano lo extiende a sus cuadros.
 */
export async function ocupacionDeVallas(desde: string, hasta: string): Promise<OcupacionSitio[]> {
  const rows = await reservasVivasEnSitiosConVallas(await tenantActual(), desde, hasta)
  return rows.map((r) => ({
    sitioId: r.sitio_id,
    marca: r.marca ?? null,
    campanaId: r.campana_id,
    campanaNombre: r.campana,
    inicio: r.inicio,
    fin: r.fin,
  }))
}

/**
 * Lee de la base lo que las reglas necesitan para verificar una candidata.
 * `sitioIds` se expande a todas las vallas de esos sitios. Ids ajenos o
 * inexistentes simplemente no aparecen (la RLS y `tenant_id` los filtran).
 */
export async function contextoParaVerificar(
  c: Omit<Candidata, 'vallaIds'> & { vallaIds?: string[]; sitioIds?: string[] },
): Promise<ContextoVallas> {
  const tenant = await tenantActual()
  const { vallas, grupos } = await listarVallasYGrupos()
  const activas = vallas.filter((v) => v.activo)
  const pedidas = new Set(c.vallaIds ?? [])
  const sitiosPedidos = new Set(c.sitioIds ?? [])
  const vallaIds = activas.filter((v) => pedidas.has(v.id) || sitiosPedidos.has(v.sitioId)).map((v) => v.id)

  const reservas = await reservasVivasEnSitiosConVallas(tenant, c.inicio, c.fin)
  const ocupaciones: Ocupacion[] = []
  for (const r of reservas) {
    if (!r.marca) continue
    for (const v of activas) {
      if (v.sitioId !== r.sitio_id) continue
      ocupaciones.push({ vallaId: v.id, marca: r.marca, inicio: r.inicio, fin: r.fin, campanaId: r.campana_id, campanaNombre: r.campana })
    }
  }

  return {
    vallas: activas,
    grupos,
    categorias: await listarCategorias(),
    ocupaciones,
    candidata: { marca: c.marca, inicio: c.inicio, fin: c.fin, vallaIds, excluirCampanaId: c.excluirCampanaId ?? null },
  }
}
