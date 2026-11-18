import 'server-only'
import type { PoolClient } from 'pg'
import { q, q1, withTenantTx } from './db'
import { tenantActual } from './tenant'
import { AppError } from './errores'
import {
  etapaOportunidadCerrada,
  problemaCambioEtapa,
  problemaFechas,
  problemaPresupuesto,
  type EtapaOportunidad,
  type TipoActividad,
} from '@/lib/crm'

// ============================================================================
//  lib/server/oportunidades-repo.ts — Lo que el cliente quiere comprar, y su
//  línea de tiempo.  ADR 0051 §1, §2 y §5.
// ----------------------------------------------------------------------------
//  CAPAS: `route.ts` → `oportunidades-controller.ts` → aquí → `db.ts`. Toda
//  operación por `id` lleva `and tenant_id = $n` como segunda capa sobre la RLS.
//
//  ─── `soloDe`: EL VENDEDOR SOLO VE LO SUYO (igual que Captación) ──────────
//  Si viene, la consulta añade `and usuario_id = $n` y una oportunidad ajena se
//  comporta como si no existiera: el controller lo traduce a 404, no a 403,
//  porque decir «existe pero no es tuya» ya cuenta algo. Quién lo recibe lo
//  decide el controller por PERMISO (`comercial.aprobar`), no por el rol.
//
//  ─── LA LÍNEA DE TIEMPO SOLO CRECE ────────────────────────────────────────
//  Aquí no hay un solo `update` ni `delete` sobre `oportunidad_actividades`, y
//  aunque lo hubiera fallaría: trigger y grants (20261117_crm_oportunidades).
//  Cada cambio de etapa escribe su fila ETAPA en la MISMA transacción: de ahí
//  salen los días en cada etapa, sin otra columna que se pueda desincronizar.
// ============================================================================

export interface Actividad {
  id: string
  tipo: TipoActividad
  usuarioNombre: string | null
  nota: string | null
  etapaAnterior: EtapaOportunidad | null
  etapaNueva: EtapaOportunidad | null
  siguientePaso: string | null
  siguientePasoFecha: string | null
  creadoEn: string
}

export interface PropuestaLigada {
  id: string
  folio: string
  nombre: string
  estatus: string
  version: number
  creadoEn: string
}

export interface Oportunidad {
  id: string
  nombre: string
  prospectoId: string | null
  prospectoNombre: string | null
  /**
   * El cliente: el que se puso, o el que nació al aprobar su prospecto
   * (`prospectos.registro_id`). Así una oportunidad abierta sobre un lead no
   * pierde a su cliente cuando el lead se aprueba, sin que la aprobación de
   * Captación tenga que saber que existen las oportunidades.
   */
  clienteId: string | null
  clienteNombre: string | null
  usuarioId: string | null
  vendedorNombre: string | null
  etapa: EtapaOportunidad
  presupuestoMin: number | null
  presupuestoMax: number | null
  fechaInicioDeseada: string | null
  fechaFinDeseada: string | null
  fechaDecision: string | null
  plazas: string | null
  tiposMedio: string[]
  objetivo: string | null
  motivoPerdida: string | null
  ganadaEn: string | null
  perdidaEn: string | null
  cotizaciones: number
  ultimaActividadEn: string | null
  creadoEn: string
  actualizadoEn: string
}

// `date` con `to_char` para que el 30 no se lea 29 en México (ver `codigos-repo.ts`).
const SEL = `o.id, o.nombre, o.prospecto_id, p.nombre as prospecto_nombre,
  coalesce(o.cliente_id, case when p.tipo = 'CLIENTE' then p.registro_id end) as cliente_id,
  c.nombre as cliente_nombre, o.usuario_id, v.nombre as vendedor_nombre, o.etapa,
  o.presupuesto_min, o.presupuesto_max,
  to_char(o.fecha_inicio_deseada,'YYYY-MM-DD') as fecha_inicio_deseada,
  to_char(o.fecha_fin_deseada,'YYYY-MM-DD') as fecha_fin_deseada,
  to_char(o.fecha_decision,'YYYY-MM-DD') as fecha_decision,
  o.plazas, o.tipos_medio, o.objetivo, o.motivo_perdida, o.ganada_en, o.perdida_en,
  (select count(*)::int from propuestas pr
    where pr.oportunidad_id = o.id and pr.tenant_id = o.tenant_id) as cotizaciones,
  (select max(a.creado_en) from oportunidad_actividades a
    where a.oportunidad_id = o.id and a.tenant_id = o.tenant_id) as ultima_actividad_en,
  o.creado_en, o.actualizado_en`

// Cada `left join` lleva `tenant_id`: la RLS ya los acota, pero un nombre de
// otra organización pegado a una oportunidad sería una fuga que no da error.
const DESDE = `from oportunidades o
  left join prospectos p on p.id = o.prospecto_id and p.tenant_id = o.tenant_id
  left join clientes c on c.id = coalesce(o.cliente_id, case when p.tipo = 'CLIENTE' then p.registro_id end)
                      and c.tenant_id = o.tenant_id
  left join usuarios v on v.id = o.usuario_id and v.tenant_id = o.tenant_id`

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v))
// `numeric` llega como cadena: a número, y null se queda null (no 0).
const num = (v: unknown) => (v == null ? null : Number(v))

function aOportunidad(r: any): Oportunidad {
  const etapa = r.etapa as EtapaOportunidad
  return {
    id: String(r.id),
    nombre: String(r.nombre),
    prospectoId: r.prospecto_id ?? null,
    prospectoNombre: r.prospecto_nombre ?? null,
    clienteId: r.cliente_id ?? null,
    clienteNombre: r.cliente_nombre ?? null,
    usuarioId: r.usuario_id ?? null,
    vendedorNombre: r.vendedor_nombre ?? null,
    etapa,
    presupuestoMin: num(r.presupuesto_min),
    presupuestoMax: num(r.presupuesto_max),
    fechaInicioDeseada: r.fecha_inicio_deseada ?? null,
    fechaFinDeseada: r.fecha_fin_deseada ?? null,
    fechaDecision: r.fecha_decision ?? null,
    plazas: r.plazas ?? null,
    tiposMedio: Array.isArray(r.tipos_medio) ? r.tipos_medio.map(String) : [],
    objetivo: r.objetivo ?? null,
    motivoPerdida: r.motivo_perdida ?? null,
    ganadaEn: iso(r.ganada_en),
    perdidaEn: iso(r.perdida_en),
    cotizaciones: Number(r.cotizaciones ?? 0),
    ultimaActividadEn: iso(r.ultima_actividad_en),
    creadoEn: iso(r.creado_en)!,
    actualizadoEn: iso(r.actualizado_en)!,
  }
}

export interface FiltroOportunidades {
  soloDe?: string | null
  etapas?: EtapaOportunidad[] | null
  clienteId?: string | null
  limite: number
  desplazamiento: number
}

/** Página de oportunidades: las abiertas primero, la que decide antes arriba. */
export async function listarOportunidades(f: FiltroOportunidades): Promise<{
  oportunidades: Oportunidad[]
  total: number
  porEtapa: Partial<Record<EtapaOportunidad, number>>
}> {
  const tenant = await tenantActual()
  const params: unknown[] = [tenant]
  let donde = 'where o.tenant_id = $1'
  if (f.soloDe) {
    params.push(f.soloDe)
    donde += ` and o.usuario_id = $${params.length}`
  }
  if (f.clienteId) {
    params.push(f.clienteId)
    donde += ` and coalesce(o.cliente_id, case when p.tipo = 'CLIENTE' then p.registro_id end) = $${params.length}`
  }
  // Los contadores del embudo: con los mismos filtros de vendedor y cliente
  // pero SIN el de etapa, contados en la base y no en la página (la lección de
  // «Por aprobar (0)» en Captación).
  const conteos = await q<{ etapa: EtapaOportunidad; n: number }>(
    `select o.etapa, count(*)::int as n
       from oportunidades o left join prospectos p on p.id = o.prospecto_id and p.tenant_id = o.tenant_id
     ${donde} group by o.etapa`,
    params,
  )
  if (f.etapas?.length) {
    params.push(f.etapas)
    donde += ` and o.etapa = any($${params.length}::text[])`
  }
  const total = await q1<{ n: number }>(
    `select count(*)::int as n
       from oportunidades o left join prospectos p on p.id = o.prospecto_id and p.tenant_id = o.tenant_id
     ${donde}`,
    params,
  )
  params.push(f.limite, f.desplazamiento)
  const filas = await q<any>(
    `select ${SEL} ${DESDE} ${donde}
      order by (o.etapa in ('GANADA','PERDIDA')) asc,
               o.fecha_decision asc nulls last,
               o.actualizado_en desc
      limit $${params.length - 1} offset $${params.length}`,
    params,
  )
  return {
    oportunidades: filas.map(aOportunidad),
    total: total?.n ?? 0,
    porEtapa: Object.fromEntries(conteos.map((c) => [c.etapa, c.n])),
  }
}

async function leerActividades(id: string, tenant: string | null): Promise<Actividad[]> {
  const filas = await q<any>(
    `select a.id, a.tipo, a.usuario_nombre, a.nota, a.etapa_anterior, a.etapa_nueva, a.siguiente_paso,
            to_char(a.siguiente_paso_fecha,'YYYY-MM-DD') as siguiente_paso_fecha, a.creado_en
       from oportunidad_actividades a
      where a.oportunidad_id = $1 and a.tenant_id = $2
      order by a.creado_en asc, a.id asc`,
    [id, tenant],
  )
  return filas.map((r) => ({
    id: String(r.id),
    tipo: r.tipo,
    usuarioNombre: r.usuario_nombre ?? null,
    nota: r.nota ?? null,
    etapaAnterior: r.etapa_anterior ?? null,
    etapaNueva: r.etapa_nueva ?? null,
    siguientePaso: r.siguiente_paso ?? null,
    siguientePasoFecha: r.siguiente_paso_fecha ?? null,
    creadoEn: iso(r.creado_en)!,
  }))
}

// Las cotizaciones ligadas pasan por la MISMA regla que la lista de propuestas
// (Fase 3, «sus propuestas el vendedor»). Quien ve todas puede ligar la
// propuesta del vendedor B a la oportunidad del vendedor A; sin este filtro, A
// veria en la ficha el folio y el historial campo por campo de una propuesta
// que en Propuestas le contesta 404.
async function leerPropuestasLigadas(
  id: string,
  tenant: string | null,
  soloDe: string | null,
): Promise<PropuestaLigada[]> {
  const filas = await q<any>(
    `select id, folio, nombre, estatus, version, creado_en from propuestas
      where oportunidad_id = $1 and tenant_id = $2 and ($3::uuid is null or usuario_id = $3::uuid)
      order by creado_en desc`,
    [id, tenant, soloDe],
  )
  return filas.map((r) => ({
    id: String(r.id),
    folio: String(r.folio),
    nombre: String(r.nombre),
    estatus: String(r.estatus),
    version: Number(r.version ?? 1),
    creadoEn: iso(r.creado_en)!,
  }))
}

export interface CambioPropuesta {
  id: string
  propuestaId: string
  folio: string
  version: number | null
  usuarioNombre: string | null
  origen: 'APP' | 'CLIENTE' | 'SISTEMA'
  accion: string
  campo: string | null
  valorAnterior: unknown
  valorNuevo: unknown
  creadoEn: string
}

/**
 * Fase 4 · el historial de las propuestas ligadas, para la línea de tiempo de
 * la ficha. Por `oportunidad_id` de la propuesta VIVA, así que un borrador ya
 * borrado no aparece aquí (su historial sigue en la tabla). Los últimos 300:
 * una ficha no es el lugar para leer miles de filas.
 */
export async function leerCambiosDePropuestas(
  oportunidadId: string,
  soloDe: string | null,
): Promise<CambioPropuesta[]> {
  const tenant = await tenantActual()
  const filas = await q<any>(
    `select c.id, c.propuesta_id, c.folio, c.version, c.usuario_nombre, c.origen, c.accion, c.campo,
            c.valor_anterior, c.valor_nuevo, c.creado_en
       from propuesta_cambios c
       join propuestas p on p.id = c.propuesta_id and p.tenant_id = c.tenant_id
      where p.oportunidad_id = $1 and c.tenant_id = $2 and ($3::uuid is null or p.usuario_id = $3::uuid)
      order by c.creado_en desc, c.id desc
      limit 300`,
    [oportunidadId, tenant, soloDe],
  )
  return filas.map((r) => ({
    id: String(r.id),
    propuestaId: String(r.propuesta_id),
    folio: String(r.folio),
    version: r.version == null ? null : Number(r.version),
    usuarioNombre: r.usuario_nombre ?? null,
    origen: r.origen,
    accion: String(r.accion),
    campo: r.campo ?? null,
    valorAnterior: r.valor_anterior ?? null,
    valorNuevo: r.valor_nuevo ?? null,
    creadoEn: iso(r.creado_en)!,
  }))
}

/** Una oportunidad con su línea de tiempo y sus cotizaciones, o null si no existe PARA QUIEN PREGUNTA. */
export async function obtenerOportunidad(
  id: string,
  soloDe?: string | null,
): Promise<(Oportunidad & { actividades: Actividad[]; propuestas: PropuestaLigada[] }) | null> {
  const tenant = await tenantActual()
  const r = await q1<any>(
    `select ${SEL} ${DESDE}
      where o.id = $1 and o.tenant_id = $2 and ($3::uuid is null or o.usuario_id = $3::uuid)`,
    [id, tenant, soloDe ?? null],
  )
  if (!r) return null
  return {
    ...aOportunidad(r),
    actividades: await leerActividades(id, tenant),
    propuestas: await leerPropuestasLigadas(id, tenant, soloDe ?? null),
  }
}

export interface DatosOportunidad {
  nombre: string
  presupuestoMin: number | null
  presupuestoMax: number | null
  fechaInicioDeseada: string | null
  fechaFinDeseada: string | null
  fechaDecision: string | null
  plazas: string | null
  tiposMedio: string[]
  objetivo: string | null
}

export interface Autor {
  id: string
  nombre: string
}

async function insertarActividad(
  client: PoolClient,
  a: {
    tenant: string | null
    oportunidadId: string
    autor: Autor
    tipo: TipoActividad
    nota: string | null
    etapaAnterior?: EtapaOportunidad | null
    etapaNueva?: EtapaOportunidad | null
    siguientePaso?: string | null
    siguientePasoFecha?: string | null
  },
) {
  await client.query(
    `insert into oportunidad_actividades (tenant_id, oportunidad_id, usuario_id, usuario_nombre, tipo, nota,
                                          etapa_anterior, etapa_nueva, siguiente_paso, siguiente_paso_fecha)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [a.tenant, a.oportunidadId, a.autor.id, a.autor.nombre.slice(0, 200), a.tipo, a.nota,
     a.etapaAnterior ?? null, a.etapaNueva ?? null, a.siguientePaso ?? null, a.siguientePasoFecha ?? null],
  )
}

/**
 * Alta, con su primera fila ETAPA en la MISMA transacción: no existe una
 * oportunidad sin historia.
 *
 * El prospecto se BLOQUEA (`for share`) y se comprueba aquí, no con un CHECK:
 * que sea de tipo CLIENTE y que quien da el alta lo pueda ver con la regla de
 * Captación (`soloDeCaptacion`). Sin eso, un vendedor podría colgar su
 * oportunidad del lead de otro vendedor con solo conocer el id.
 */
export async function crearOportunidad(
  d: DatosOportunidad & { prospectoId: string | null; clienteId: string | null; nota: string | null },
  autor: Autor,
  soloDeCaptacion: string | null,
): Promise<string> {
  const tenant = await tenantActual()
  return withTenantTx(async (client) => {
    let clienteId = d.clienteId
    if (d.prospectoId) {
      const { rows } = await client.query(
        `select tipo, registro_id from prospectos
          where id = $1 and tenant_id = $2 and ($3::uuid is null or usuario_id = $3::uuid)
          for share`,
        [d.prospectoId, tenant, soloDeCaptacion],
      )
      const p = rows[0]
      if (!p) throw new AppError('Ese prospecto no existe', 404)
      if (p.tipo !== 'CLIENTE') throw new AppError('Solo un prospecto de tipo cliente puede tener oportunidades', 409)
      if (p.registro_id) {
        if (clienteId && clienteId !== String(p.registro_id)) {
          throw new AppError('Ese prospecto ya es otro cliente', 409)
        }
        clienteId = String(p.registro_id)
      }
    }
    if (clienteId) {
      const { rows } = await client.query('select 1 from clientes where id = $1 and tenant_id = $2', [clienteId, tenant])
      if (!rows[0]) throw new AppError('Ese cliente no existe', 404)
    }
    const { rows } = await client.query(
      `insert into oportunidades (tenant_id, prospecto_id, cliente_id, nombre, usuario_id, presupuesto_min,
                                  presupuesto_max, fecha_inicio_deseada, fecha_fin_deseada, fecha_decision,
                                  plazas, tipos_medio, objetivo)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::text[],$13) returning id`,
      [tenant, d.prospectoId, clienteId, d.nombre, autor.id, d.presupuestoMin, d.presupuestoMax,
       d.fechaInicioDeseada, d.fechaFinDeseada, d.fechaDecision, d.plazas, d.tiposMedio, d.objetivo],
    )
    const id = String(rows[0].id)
    await insertarActividad(client, {
      tenant, oportunidadId: id, autor, tipo: 'ETAPA', nota: d.nota, etapaAnterior: null, etapaNueva: 'CONTACTO',
    })
    return id
  })
}

// Lee y BLOQUEA la fila. Todo cambio pasa por aquí: dos ediciones o dos cambios
// de etapa simultáneos se ponen en fila en vez de pisarse, y la regla se aplica
// contra lo que hay DE VERDAD, no contra lo que la pantalla creía.
async function bloquear(client: PoolClient, tenant: string | null, id: string, soloDe: string | null) {
  const { rows } = await client.query(
    `select id, etapa, presupuesto_min, presupuesto_max,
            to_char(fecha_inicio_deseada,'YYYY-MM-DD') as fecha_inicio_deseada,
            to_char(fecha_fin_deseada,'YYYY-MM-DD') as fecha_fin_deseada
       from oportunidades
      where id = $1 and tenant_id = $2 and ($3::uuid is null or usuario_id = $3::uuid)
      for update`,
    [id, tenant, soloDe],
  )
  return rows[0] ?? null
}

const COLUMNA: Record<keyof DatosOportunidad, string> = {
  nombre: 'nombre',
  presupuestoMin: 'presupuesto_min',
  presupuestoMax: 'presupuesto_max',
  fechaInicioDeseada: 'fecha_inicio_deseada',
  fechaFinDeseada: 'fecha_fin_deseada',
  fechaDecision: 'fecha_decision',
  plazas: 'plazas',
  tiposMedio: 'tipos_medio',
  objetivo: 'objetivo',
}

/**
 * Edita lo que pide el cliente. Lo que no viene no se toca; null lo borra.
 * Cerrada ya es historia y no se edita. El presupuesto y las fechas se comparan
 * contra lo que YA está guardado: mandar solo un mínimo mayor que el máximo de
 * la base es el mismo error que mandar los dos al revés.
 * Devuelve false si no existe para quien pregunta.
 */
export async function editarOportunidad(
  id: string,
  cambios: Partial<DatosOportunidad>,
  soloDe: string | null,
): Promise<boolean> {
  const tenant = await tenantActual()
  return withTenantTx(async (client) => {
    const actual = await bloquear(client, tenant, id, soloDe)
    if (!actual) return false
    if (etapaOportunidadCerrada(actual.etapa)) throw new AppError('La oportunidad ya está cerrada', 409)
    const de = <K extends keyof DatosOportunidad>(k: K, guardado: unknown) =>
      (k in cambios ? cambios[k] : guardado) as DatosOportunidad[K]
    if (problemaPresupuesto(
      de('presupuestoMin', num(actual.presupuesto_min)) as number | null,
      de('presupuestoMax', num(actual.presupuesto_max)) as number | null,
    )) {
      throw new AppError('El presupuesto mínimo no puede ser mayor que el máximo', 409)
    }
    if (problemaFechas(
      de('fechaInicioDeseada', actual.fecha_inicio_deseada) as string | null,
      de('fechaFinDeseada', actual.fecha_fin_deseada) as string | null,
    )) {
      throw new AppError('La fecha de inicio no puede ir después de la de fin', 409)
    }
    const sets: string[] = []
    const params: unknown[] = [id, tenant]
    for (const k of Object.keys(COLUMNA) as (keyof DatosOportunidad)[]) {
      if (!(k in cambios)) continue
      params.push(k === 'tiposMedio' ? (cambios[k] ?? []) : cambios[k])
      sets.push(`${COLUMNA[k]} = $${params.length}${k === 'tiposMedio' ? '::text[]' : ''}`)
    }
    if (sets.length) {
      await client.query(`update oportunidades set ${sets.join(', ')} where id = $1 and tenant_id = $2`, params)
    }
    return true
  })
}

/**
 * Cambia la etapa y deja la fila ETAPA en la misma transacción. Al ganar o
 * perder se estampa la fecha; al perder, además, el motivo.
 * Devuelve false si no existe para quien pregunta.
 */
export async function cambiarEtapa(
  id: string,
  c: { etapa: EtapaOportunidad; nota: string | null; motivoPerdida: string | null },
  autor: Autor,
  soloDe: string | null,
): Promise<boolean> {
  const tenant = await tenantActual()
  return withTenantTx(async (client) => {
    const actual = await bloquear(client, tenant, id, soloDe)
    if (!actual) return false
    switch (problemaCambioEtapa(actual.etapa, c.etapa, c.motivoPerdida)) {
      case 'MISMA':
        throw new AppError('La oportunidad ya está en esa etapa', 409)
      case 'CERRADA':
        throw new AppError('La oportunidad ya está cerrada', 409)
      case 'SIN_MOTIVO':
        throw new AppError('Escribe por qué se perdió', 400)
    }
    await client.query(
      `update oportunidades
          set etapa = $3,
              ganada_en  = case when $3 = 'GANADA'  then now() else ganada_en  end,
              perdida_en = case when $3 = 'PERDIDA' then now() else perdida_en end,
              motivo_perdida = case when $3 = 'PERDIDA' then $4 else motivo_perdida end
        where id = $1 and tenant_id = $2`,
      [id, tenant, c.etapa, c.motivoPerdida?.trim() || null],
    )
    await insertarActividad(client, {
      tenant, oportunidadId: id, autor, tipo: 'ETAPA',
      nota: c.etapa === 'PERDIDA' ? (c.nota ?? c.motivoPerdida?.trim() ?? null) : c.nota,
      etapaAnterior: actual.etapa, etapaNueva: c.etapa,
    })
    return true
  })
}

/**
 * ADR 0051 §3 · ¿se puede ligar una propuesta a esta oportunidad? La lee
 * BLOQUEADA (`for share`) con el cliente de la transacción de quien liga, para
 * que nadie la marque perdida en medio. Lanza el error que toca; si pasa,
 * devuelve nada.
 *
 *  · tiene que existir PARA QUIEN LIGA (`soloDe`, la regla de las
 *    oportunidades): un vendedor no cuelga su cotización de la de otro;
 *  · una perdida ya no recibe cotizaciones (una ganada sí: una adenda);
 *  · si las dos tienen cliente, tiene que ser el mismo. El de la oportunidad
 *    es el que se puso o el que nació de su prospecto.
 */
export async function revisarOportunidadParaLigar(
  client: PoolClient,
  tenant: string | null,
  oportunidadId: string,
  clienteDePropuesta: string | null,
  soloDe: string | null,
): Promise<void> {
  const { rows } = await client.query(
    `select o.etapa, coalesce(o.cliente_id, case when p.tipo = 'CLIENTE' then p.registro_id end) as cliente_id
       from oportunidades o
       left join prospectos p on p.id = o.prospecto_id and p.tenant_id = o.tenant_id
      where o.id = $1 and o.tenant_id = $2 and ($3::uuid is null or o.usuario_id = $3::uuid)
      for share of o`,
    [oportunidadId, tenant, soloDe],
  )
  const o = rows[0]
  if (!o) throw new AppError('Esa oportunidad no existe', 404)
  if (o.etapa === 'PERDIDA') throw new AppError('La oportunidad ya está cerrada', 409)
  if (o.cliente_id && clienteDePropuesta && String(o.cliente_id) !== clienteDePropuesta) {
    throw new AppError('La propuesta es de otro cliente que la oportunidad', 409)
  }
}

/**
 * Una llamada, visita, junta, correo, WhatsApp o nota. Se puede también con la
 * oportunidad cerrada: lo que pasa después de ganar (el cliente pide otra cosa)
 * sigue siendo historia. Devuelve false si no existe para quien pregunta.
 */
export async function registrarActividad(
  id: string,
  a: { tipo: Exclude<TipoActividad, 'ETAPA'>; nota: string; siguientePaso: string | null; siguientePasoFecha: string | null },
  autor: Autor,
  soloDe: string | null,
): Promise<boolean> {
  const tenant = await tenantActual()
  return withTenantTx(async (client) => {
    const { rows } = await client.query(
      `select 1 from oportunidades
        where id = $1 and tenant_id = $2 and ($3::uuid is null or usuario_id = $3::uuid)
        for share`,
      [id, tenant, soloDe],
    )
    if (!rows[0]) return false
    await insertarActividad(client, {
      tenant, oportunidadId: id, autor, tipo: a.tipo, nota: a.nota,
      siguientePaso: a.siguientePaso, siguientePasoFecha: a.siguientePasoFecha,
    })
    return true
  })
}
