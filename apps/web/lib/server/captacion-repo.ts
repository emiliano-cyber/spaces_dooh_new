import 'server-only'
import type { PoolClient } from 'pg'
import { q, q1, withTenantTx } from './db'
import { tenantActual } from './tenant'
import { AppError } from './errores'
import {
  ETIQUETA_ETAPA,
  etapaCerrada,
  faltantesParaRevision,
  motivoAvanceInvalido,
  motivoDecisionInvalida,
  type ContactoProspecto,
  type Etapa,
  type TipoProspecto,
} from '@/lib/captacion'

// ============================================================================
//  lib/server/captacion-repo.ts — Prospectos y su bitácora.  CAP-01.
// ----------------------------------------------------------------------------
//  CAPAS: `route.ts` → `captacion-controller.ts` → aquí → `db.ts`. El SQL vive
//  aquí, parametrizado, y toda operación por `id` lleva `and tenant_id = $n`
//  como segunda capa sobre la RLS.
//
//  ─── `soloDe`: EL VENDEDOR SOLO VE LO SUYO ───────────────────────────────
//  Casi todas las funciones reciben `soloDe`. Si viene, la consulta añade
//  `and usuario_id = $n`, y un prospecto de otro vendedor se comporta como si
//  no existiera — el controller lo traduce a 404, no a 403, porque decir «existe
//  pero no es tuyo» ya cuenta algo. Quién lo recibe lo decide el controller por
//  PERMISO (`captacion.aprobar`), no por el nombre del rol: así la matriz de
//  Administración sigue mandando.
//
//  ─── LA BITÁCORA SOLO CRECE ───────────────────────────────────────────────
//  Aquí no hay un solo `update` ni `delete` sobre `prospecto_avances`, y aunque
//  lo hubiera fallaría: la migración le deja al rol de la aplicación `select,
//  insert` y nada más.
// ============================================================================

export interface Avance {
  id: string
  usuarioNombre: string | null
  etapaAnterior: Etapa | null
  etapaNueva: Etapa
  nota: string
  creadoEn: string
}

export interface Prospecto {
  id: string
  tipo: TipoProspecto
  nombre: string
  contacto: ContactoProspecto
  direccion: string | null
  lat: number | null
  lng: number | null
  datos: Record<string, unknown>
  etapa: Etapa
  siguientePaso: string | null
  siguientePasoFecha: string | null
  usuarioId: string | null
  vendedorNombre: string | null
  decididoPorNombre: string | null
  decididoEn: string | null
  motivoRechazo: string | null
  registroId: string | null
  creadoEn: string
  actualizadoEn: string
}

// `numeric` llega como cadena y `date` como `Date` con zona: las fechas se traen
// con `to_char` para que el 30 no se lea 29 en México (ver `codigos-repo.ts`).
const SEL = `p.id, p.tipo, p.nombre, p.contacto, p.direccion, p.lat, p.lng, p.datos,
  p.etapa, p.siguiente_paso, to_char(p.siguiente_paso_fecha,'YYYY-MM-DD') as siguiente_paso_fecha,
  p.usuario_id, v.nombre as vendedor_nombre, d.nombre as decidido_por_nombre,
  p.decidido_en, p.motivo_rechazo, p.registro_id, p.creado_en, p.actualizado_en`

// Los `left join` a `usuarios` van con `tenant_id` también: la RLS ya los
// acota, pero un nombre de otra organización pegado a un prospecto sería una
// fuga que no da error.
const DESDE = `from prospectos p
  left join usuarios v on v.id = p.usuario_id and v.tenant_id = p.tenant_id
  left join usuarios d on d.id = p.decidido_por and d.tenant_id = p.tenant_id`

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v))

function aProspecto(r: any): Prospecto {
  return {
    id: String(r.id),
    tipo: r.tipo,
    nombre: String(r.nombre),
    contacto: r.contacto ?? {},
    direccion: r.direccion ?? null,
    lat: r.lat != null ? Number(r.lat) : null,
    lng: r.lng != null ? Number(r.lng) : null,
    datos: r.datos ?? {},
    etapa: r.etapa,
    siguientePaso: r.siguiente_paso ?? null,
    siguientePasoFecha: r.siguiente_paso_fecha ?? null,
    usuarioId: r.usuario_id ?? null,
    vendedorNombre: r.vendedor_nombre ?? null,
    decididoPorNombre: r.decidido_por_nombre ?? null,
    decididoEn: iso(r.decidido_en),
    motivoRechazo: r.motivo_rechazo ?? null,
    registroId: r.registro_id ?? null,
    creadoEn: iso(r.creado_en)!,
    actualizadoEn: iso(r.actualizado_en)!,
  }
}

export interface FiltroProspectos {
  soloDe?: string | null
  /** Un GRUPO de etapas: la pestaña entera, no una sola. */
  etapas?: Etapa[] | null
  tipo?: TipoProspecto | null
  limite: number
  desplazamiento: number
}

/** Página de prospectos, los que tienen algo pendiente primero. */
export async function listarProspectos(f: FiltroProspectos): Promise<{
  prospectos: Prospecto[]
  total: number
  porEtapa: Partial<Record<Etapa, number>>
}> {
  const tenant = await tenantActual()
  const params: unknown[] = [tenant]
  let donde = 'where p.tenant_id = $1'
  if (f.soloDe) {
    params.push(f.soloDe)
    donde += ` and p.usuario_id = $${params.length}`
  }
  if (f.tipo) {
    params.push(f.tipo)
    donde += ` and p.tipo = $${params.length}`
  }
  // Los contadores de las pestañas: por etapa, con los mismos filtros de
  // vendedor y tipo pero SIN el de etapa. Se cuentan en la base y no en el
  // navegador: contando la página, un gerente con más prospectos que los de
  // una página veía «Por aprobar (0)» con uno esperando.
  const conteos = await q<{ etapa: Etapa; n: number }>(
    `select p.etapa, count(*)::int as n from prospectos p ${donde} group by p.etapa`,
    params,
  )
  if (f.etapas?.length) {
    params.push(f.etapas)
    donde += ` and p.etapa = any($${params.length}::text[])`
  }
  const total = await q1<{ n: number }>(`select count(*)::int as n from prospectos p ${donde}`, params)
  params.push(f.limite, f.desplazamiento)
  const filas = await q<any>(
    `select ${SEL} ${DESDE} ${donde}
      order by (p.etapa in ('APROBADO','PERDIDO')) asc,
               p.siguiente_paso_fecha asc nulls last,
               p.actualizado_en desc
      limit $${params.length - 1} offset $${params.length}`,
    params,
  )
  return {
    prospectos: filas.map(aProspecto),
    total: total?.n ?? 0,
    porEtapa: Object.fromEntries(conteos.map((c) => [c.etapa, c.n])),
  }
}

async function leerAvances(id: string): Promise<Avance[]> {
  const tenant = await tenantActual()
  const filas = await q<any>(
    `select a.id, u.nombre as usuario_nombre, a.etapa_anterior, a.etapa_nueva, a.nota, a.creado_en
       from prospecto_avances a
       left join usuarios u on u.id = a.usuario_id and u.tenant_id = a.tenant_id
      where a.prospecto_id = $1 and a.tenant_id = $2
      order by a.creado_en asc, a.id asc`,
    [id, tenant],
  )
  return filas.map((r) => ({
    id: String(r.id),
    usuarioNombre: r.usuario_nombre ?? null,
    etapaAnterior: r.etapa_anterior ?? null,
    etapaNueva: r.etapa_nueva,
    nota: String(r.nota),
    creadoEn: iso(r.creado_en)!,
  }))
}

/** Un prospecto con su bitácora, o null si no existe PARA QUIEN PREGUNTA. */
export async function obtenerProspecto(
  id: string,
  soloDe?: string | null,
): Promise<(Prospecto & { avances: Avance[] }) | null> {
  const tenant = await tenantActual()
  const r = await q1<any>(
    `select ${SEL} ${DESDE}
      where p.id = $1 and p.tenant_id = $2 and ($3::uuid is null or p.usuario_id = $3::uuid)`,
    [id, tenant, soloDe ?? null],
  )
  if (!r) return null
  return { ...aProspecto(r), avances: await leerAvances(id) }
}

export interface ProspectoInput {
  tipo: TipoProspecto
  nombre: string
  contacto: ContactoProspecto
  direccion: string | null
  lat: number | null
  lng: number | null
  datos: Record<string, unknown>
  siguientePaso: string | null
  siguientePasoFecha: string | null
}

async function insertarAvance(
  client: PoolClient,
  a: { tenant: string | null; prospectoId: string; usuarioId: string; anterior: Etapa | null; nueva: Etapa; nota: string },
) {
  await client.query(
    `insert into prospecto_avances (tenant_id, prospecto_id, usuario_id, etapa_anterior, etapa_nueva, nota)
     values ($1,$2,$3,$4,$5,$6)`,
    [a.tenant, a.prospectoId, a.usuarioId, a.anterior, a.nueva, a.nota],
  )
}

/**
 * Alta de un prospecto, con su primera línea de bitácora en la MISMA
 * transacción: no existe un prospecto sin historia.
 *
 * `usuarioId` lo pasa el controller desde la sesión. No hay forma de dar de
 * alta un prospecto «a nombre de» otro vendedor.
 */
export async function crearProspecto(
  input: ProspectoInput,
  usuarioId: string,
  nota: string,
): Promise<string> {
  const tenant = await tenantActual()
  return withTenantTx(async (client) => {
    const { rows } = await client.query(
      `insert into prospectos (tenant_id, tipo, nombre, contacto, direccion, lat, lng, datos,
                               siguiente_paso, siguiente_paso_fecha, usuario_id)
       values ($1,$2,$3,$4::jsonb,$5,$6,$7,$8::jsonb,$9,$10,$11) returning id`,
      [tenant, input.tipo, input.nombre, JSON.stringify(input.contacto), input.direccion,
       input.lat, input.lng, JSON.stringify(input.datos), input.siguientePaso,
       input.siguientePasoFecha, usuarioId],
    )
    const id = String(rows[0].id)
    await insertarAvance(client, { tenant, prospectoId: id, usuarioId, anterior: null, nueva: 'PROSPECTO', nota })
    return id
  })
}

// Lee y BLOQUEA la fila. Todo cambio de etapa pasa por aquí: dos avances o dos
// decisiones simultáneas se ponen en fila en vez de pisarse, y la regla de
// `lib/captacion.ts` se aplica contra la etapa que hay DE VERDAD, no contra la
// que la pantalla creía.
async function bloquear(client: PoolClient, tenant: string | null, id: string, soloDe?: string | null) {
  const { rows } = await client.query(
    `select id, tipo, nombre, contacto, direccion, datos, etapa from prospectos
      where id = $1 and tenant_id = $2 and ($3::uuid is null or usuario_id = $3::uuid)
      for update`,
    [id, tenant, soloDe ?? null],
  )
  return rows[0] ?? null
}

/**
 * Edita los datos. No se puede con el prospecto cerrado ni en revisión: en
 * revisión cambiaría lo que alguien está revisando, y cerrado ya es historia.
 * Devuelve false si no existe para quien pregunta.
 */
export async function editarProspecto(
  id: string,
  input: ProspectoInput,
  soloDe?: string | null,
): Promise<boolean> {
  const tenant = await tenantActual()
  return withTenantTx(async (client) => {
    const p = await bloquear(client, tenant, id, soloDe)
    if (!p) return false
    if (etapaCerrada(p.etapa) || p.etapa === 'EN_REVISION') {
      throw new AppError(
        `No se puede editar un prospecto ${ETIQUETA_ETAPA[p.etapa as Etapa].toLowerCase()}`,
        409,
      )
    }
    // El TIPO no se edita: cambiarlo cambiaría qué registro se crea al aprobar.
    await client.query(
      `update prospectos set nombre=$3, contacto=$4::jsonb, direccion=$5, lat=$6, lng=$7,
              datos=$8::jsonb, siguiente_paso=$9, siguiente_paso_fecha=$10
        where id=$1 and tenant_id=$2`,
      [id, tenant, input.nombre, JSON.stringify(input.contacto), input.direccion, input.lat,
       input.lng, JSON.stringify(input.datos), input.siguientePaso, input.siguientePasoFecha],
    )
    return true
  })
}

/**
 * Registra un avance. Devuelve false si el prospecto no existe para quien
 * pregunta. Una transición inválida, o enviar a revisión con datos faltantes,
 * es un 409 con la frase que dice qué hacer.
 */
export async function registrarAvance(
  id: string,
  a: { etapaNueva: Etapa; nota: string; siguientePaso?: string | null; siguientePasoFecha?: string | null },
  usuarioId: string,
  soloDe?: string | null,
): Promise<boolean> {
  const tenant = await tenantActual()
  return withTenantTx(async (client) => {
    const p = await bloquear(client, tenant, id, soloDe)
    if (!p) return false
    const motivo = motivoAvanceInvalido(p.etapa, a.etapaNueva)
    if (motivo) throw new AppError(motivo, 409)
    if (a.etapaNueva === 'EN_REVISION' && p.etapa !== 'EN_REVISION') {
      const faltan = faltantesParaRevision({
        tipo: p.tipo, nombre: p.nombre, contacto: p.contacto ?? {},
        direccion: p.direccion, datos: p.datos ?? {},
      })
      if (faltan.length) {
        throw new AppError(`Para enviarlo a revisión falta: ${faltan.join(', ')}`, 409)
      }
    }
    await insertarAvance(client, {
      tenant, prospectoId: id, usuarioId, anterior: p.etapa, nueva: a.etapaNueva, nota: a.nota,
    })
    // `undefined` = no lo tocó; `null` = lo borró. Por eso el `case`.
    await client.query(
      `update prospectos set etapa = $3,
              siguiente_paso = case when $4::boolean then $5 else siguiente_paso end,
              siguiente_paso_fecha = case when $4::boolean then $6::date else siguiente_paso_fecha end
        where id = $1 and tenant_id = $2`,
      [id, tenant, a.etapaNueva, a.siguientePaso !== undefined || a.siguientePasoFecha !== undefined,
       a.siguientePaso ?? null, a.siguientePasoFecha ?? null],
    )
    return true
  })
}

export interface ProspectoReclamado {
  id: string
  tipo: TipoProspecto
  nombre: string
  contacto: ContactoProspecto
  direccion: string | null
  lat: number | null
  lng: number | null
  datos: Record<string, unknown>
}

/**
 * Rechaza: vuelve al vendedor con el motivo. Todo en una transacción.
 * Devuelve false si no existe.
 */
export async function rechazarProspecto(id: string, motivo: string, usuarioId: string): Promise<boolean> {
  const tenant = await tenantActual()
  return withTenantTx(async (client) => {
    const p = await bloquear(client, tenant, id)
    if (!p) return false
    const invalida = motivoDecisionInvalida(p.etapa)
    if (invalida) throw new AppError(invalida, 409)
    await client.query(
      `update prospectos set etapa='RECHAZADO', motivo_rechazo=$3, decidido_por=$4, decidido_en=now()
        where id=$1 and tenant_id=$2 and etapa='EN_REVISION'`,
      [id, tenant, motivo, usuarioId],
    )
    await insertarAvance(client, {
      tenant, prospectoId: id, usuarioId, anterior: 'EN_REVISION', nueva: 'RECHAZADO',
      nota: `Rechazado: ${motivo}`,
    })
    return true
  })
}

/**
 * PRIMER PASO de aprobar: RECLAMA el prospecto pasándolo a APROBADO con la fila
 * bloqueada, y devuelve lo necesario para crear el registro real.
 *
 * ─── POR QUÉ EN DOS PASOS ─────────────────────────────────────────────────
 * El registro real lo crean `crearCliente`, `crearArrendador` y `crearPredio`,
 * que son de OTROS módulos y abren su propia transacción. Reescribir aquí su
 * SQL duplicaría sus comprobaciones de duplicados, y dos copias divergen. Así
 * que se reclama primero —y solo UNA petición puede reclamar: la segunda
 * encuentra APROBADO y recibe 409, que es el doble clic en «Aprobar»— y después
 * se crea el registro. Si crearlo falla (p. ej. ya existe un arrendador con ese
 * nombre), `devolverARevision` deshace el reclamo y el error llega entero a
 * quien aprueba, que puede confirmar y repetir.
 *
 * La línea de bitácora NO se escribe aquí sino en `fijarRegistro`: la
 * bitácora no se puede borrar, así que no se escribe «aprobado» hasta que el
 * registro existe de verdad.
 */
export async function reclamarAprobacion(id: string, usuarioId: string): Promise<ProspectoReclamado | null> {
  const tenant = await tenantActual()
  return withTenantTx(async (client) => {
    const p = await bloquear(client, tenant, id)
    if (!p) return null
    const invalida = motivoDecisionInvalida(p.etapa)
    if (invalida) throw new AppError(invalida, 409)
    const { rows } = await client.query(
      `update prospectos set etapa='APROBADO', decidido_por=$3, decidido_en=now(), motivo_rechazo=null
        where id=$1 and tenant_id=$2 and etapa='EN_REVISION'
        returning id, tipo, nombre, contacto, direccion, lat, lng, datos`,
      [id, tenant, usuarioId],
    )
    // Segunda defensa, además del `for update`: el reclamo solo casa si SIGUE
    // en revisión. Con las dos, quitar una no abre la carrera; la prueba 11 de
    // `captacion.e2e.test.ts` las quita juntas para ver que muerde.
    const r = rows[0]
    if (!r) throw new AppError('Este prospecto ya se decidió', 409)
    return {
      id: String(r.id), tipo: r.tipo, nombre: String(r.nombre), contacto: r.contacto ?? {},
      direccion: r.direccion ?? null, lat: r.lat != null ? Number(r.lat) : null,
      lng: r.lng != null ? Number(r.lng) : null, datos: r.datos ?? {},
    }
  })
}

/** Deshace un reclamo cuyo registro no se pudo crear. */
export async function devolverARevision(id: string): Promise<void> {
  const tenant = await tenantActual()
  await q(
    `update prospectos set etapa='EN_REVISION', decidido_por=null, decidido_en=null
      where id=$1 and tenant_id=$2 and etapa='APROBADO' and registro_id is null`,
    [id, tenant],
  )
}

/** SEGUNDO PASO: el registro existe. Se enlaza y se escribe en la bitácora. */
export async function fijarRegistro(
  id: string,
  registroId: string | null,
  nota: string,
  usuarioId: string,
): Promise<void> {
  const tenant = await tenantActual()
  await withTenantTx(async (client) => {
    await client.query(
      'update prospectos set registro_id=$3 where id=$1 and tenant_id=$2',
      [id, tenant, registroId],
    )
    await insertarAvance(client, {
      tenant, prospectoId: id, usuarioId, anterior: 'EN_REVISION', nueva: 'APROBADO', nota,
    })
  })
}
