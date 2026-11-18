import 'server-only'
import type { PoolClient } from 'pg'
import { q, withTenantTx } from './db'
import { tenantActual } from './tenant'
import { AppError } from './errores'
import { insertarAvance } from './captacion-repo'
import type { Etapa } from '@/lib/captacion'
import {
  ETAPAS_RESPONSABLE,
  motivoCambioOferta,
  motivoEdicion,
  motivoEtapaResponsable,
  motivoPresupuesto,
  motivoQuitarLegal,
  siguienteVersion,
  type EstadoOferta,
  type Visibilidad,
} from '@/lib/negociacion'

// ============================================================================
//  lib/server/negociacion-repo.ts — Lo que Comercial negociación añade a un
//  prospecto: la ficha, los contactos, las ofertas al dueño, la competencia y
//  las notas.  NEG-01.
// ----------------------------------------------------------------------------
//  CAPAS: `route.ts` → `negociacion-controller.ts` → aquí → `db.ts`. Todo SQL
//  parametrizado y con `and tenant_id = $n` además de la RLS.
//
//  ─── TODA ESCRITURA EMPIEZA BLOQUEANDO EL PROSPECTO ───────────────────────
//  `bloquear()` lee el prospecto `for update`, con el mismo `soloDe` que
//  Captación: si no es de quien pregunta, no existe, y el controller contesta
//  404. Bloquearlo pone en fila dos cambios simultáneos sobre el mismo espacio,
//  y es lo que hace ciertas tres reglas que dependen de más de una fila:
//   · la etapa 5 exige un contacto que firme — y no se le puede quitar la firma
//     al único mientras siga en 5;
//   · la versión de una oferta es la mayor + 1;
//   · el presupuesto se compara con el extremo que YA estaba guardado.
//
//  Las funciones devuelven `false` cuando el prospecto (o el hijo) no existe
//  para quien pregunta; el controller lo traduce a 404.
// ============================================================================

export interface Contacto {
  id: string
  nombre: string
  papel: string | null
  telefono: string | null
  email: string | null
  esLegal: boolean
  creadoEn: string
}

export interface Oferta {
  id: string
  version: number
  fecha: string
  importeMensual: number
  plazoMeses: number
  estado: EstadoOferta
  notas: string | null
  creadoPorNombre: string | null
  creadoEn: string
}

export interface Competidor {
  id: string
  nombre: string
  nota: string | null
  desde: string | null
}

export interface Nota {
  id: string
  texto: string
  autorNombre: string | null
  creadoEn: string
}

export interface HijosNegociacion {
  contactos: Contacto[]
  ofertas: Oferta[]
  competencia: Competidor[]
  notas: Nota[]
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v))

async function leerContactos(id: string, tenant: string | null, client?: PoolClient): Promise<Contacto[]> {
  const sql = `select id, nombre, papel, telefono, email, es_legal, creado_en from prospecto_contactos
                where prospecto_id = $1 and tenant_id = $2 order by creado_en asc, id asc`
  const filas = client ? (await client.query(sql, [id, tenant])).rows : await q<any>(sql, [id, tenant])
  return filas.map((r: any) => ({
    id: String(r.id),
    nombre: String(r.nombre),
    papel: r.papel ?? null,
    telefono: r.telefono ?? null,
    email: r.email ?? null,
    esLegal: r.es_legal === true,
    creadoEn: iso(r.creado_en)!,
  }))
}

export async function listarNotas(id: string): Promise<Nota[]> {
  const tenant = await tenantActual()
  const filas = await q<any>(
    `select n.id, n.texto, u.nombre as autor_nombre, n.creado_en
       from prospecto_notas n
       left join usuarios u on u.id = n.usuario_id and u.tenant_id = n.tenant_id
      where n.prospecto_id = $1 and n.tenant_id = $2
      order by n.creado_en desc, n.id desc`,
    [id, tenant],
  )
  return filas.map((r) => ({
    id: String(r.id),
    texto: String(r.texto),
    autorNombre: r.autor_nombre ?? null,
    creadoEn: iso(r.creado_en)!,
  }))
}

/**
 * Los hijos de un prospecto que YA se sabe que es de quien pregunta: lo llama
 * el controller después de `obtenerProspecto`, que es quien aplica `soloDe`.
 */
export async function leerHijos(id: string): Promise<HijosNegociacion> {
  const tenant = await tenantActual()
  const [contactos, ofertas, competencia, notas] = await Promise.all([
    leerContactos(id, tenant),
    q<any>(
      `select o.id, o.version, to_char(o.fecha,'YYYY-MM-DD') as fecha, o.importe_mensual, o.plazo_meses,
              o.estado, o.notas, u.nombre as creado_por_nombre, o.creado_en
         from prospecto_ofertas o
         left join usuarios u on u.id = o.creado_por and u.tenant_id = o.tenant_id
        where o.prospecto_id = $1 and o.tenant_id = $2
        order by o.version desc`,
      [id, tenant],
    ),
    q<any>(
      `select id, nombre, nota, to_char(desde,'YYYY-MM-DD') as desde from prospecto_competencia
        where prospecto_id = $1 and tenant_id = $2 order by creado_en asc, id asc`,
      [id, tenant],
    ),
    listarNotas(id),
  ])
  return {
    contactos,
    ofertas: ofertas.map((r) => ({
      id: String(r.id),
      version: Number(r.version),
      fecha: String(r.fecha),
      importeMensual: Number(r.importe_mensual),
      plazoMeses: Number(r.plazo_meses),
      estado: r.estado,
      notas: r.notas ?? null,
      creadoPorNombre: r.creado_por_nombre ?? null,
      creadoEn: iso(r.creado_en)!,
    })),
    competencia: competencia.map((r) => ({
      id: String(r.id),
      nombre: String(r.nombre),
      nota: r.nota ?? null,
      desde: r.desde ?? null,
    })),
    notas,
  }
}

interface Bloqueado {
  etapa: Etapa
  etapa_responsable: number | null
  presupuesto_min: string | null
  presupuesto_max: string | null
}

async function bloquear(client: PoolClient, tenant: string | null, id: string, soloDe?: string | null) {
  const { rows } = await client.query(
    `select etapa, etapa_responsable, presupuesto_min, presupuesto_max from prospectos
      where id = $1 and tenant_id = $2 and ($3::uuid is null or usuario_id = $3::uuid)
      for update`,
    [id, tenant, soloDe ?? null],
  )
  return (rows[0] as Bloqueado | undefined) ?? null
}

function exigirEdicion(p: Bloqueado, que: 'ficha' | 'hijos' | 'notas') {
  const motivo = motivoEdicion(p.etapa, que)
  if (motivo) throw new AppError(motivo, 409)
}

// ─── La ficha ───────────────────────────────────────────────────────────────

export interface CambiosFicha {
  tipoEspacio?: string | null
  etapaResponsable?: number | null
  visibilidad?: Visibilidad | null
  anchoM?: number | null
  altoM?: number | null
  superficieM2?: number | null
  presupuestoMin?: number | null
  presupuestoMax?: number | null
  presupuestoAutoriza?: string | null
  /** null la borra; undefined no la toca. */
  ubicacion?: { lat: number; lng: number; origen: 'PIN' | 'BUSCADOR'; placeId: string | null } | null
}

// La lista blanca de columnas que la ficha puede escribir. Nada del cuerpo se
// convierte en nombre de columna: sale de aquí.
const COLUMNAS: [keyof CambiosFicha, string][] = [
  ['tipoEspacio', 'tipo_espacio'],
  ['etapaResponsable', 'etapa_responsable'],
  ['visibilidad', 'visibilidad'],
  ['anchoM', 'ancho_m'],
  ['altoM', 'alto_m'],
  ['superficieM2', 'superficie_m2'],
  ['presupuestoMin', 'presupuesto_min'],
  ['presupuestoMax', 'presupuesto_max'],
  ['presupuestoAutoriza', 'presupuesto_autoriza'],
]

/**
 * Cambia la ficha. Lo que no viene (`undefined`) no se toca; `null` lo borra.
 * Quien fija la ubicación sale de `usuarioId` (la sesión), nunca del cuerpo.
 */
export async function editarFicha(
  id: string,
  cambios: CambiosFicha,
  usuarioId: string,
  soloDe?: string | null,
): Promise<boolean> {
  const tenant = await tenantActual()
  return withTenantTx(async (client) => {
    const p = await bloquear(client, tenant, id, soloDe)
    if (!p) return false
    exigirEdicion(p, 'ficha')

    const min = cambios.presupuestoMin !== undefined ? cambios.presupuestoMin : p.presupuesto_min != null ? Number(p.presupuesto_min) : null
    const max = cambios.presupuestoMax !== undefined ? cambios.presupuestoMax : p.presupuesto_max != null ? Number(p.presupuesto_max) : null
    const malPresupuesto = motivoPresupuesto(min, max)
    if (malPresupuesto) throw new AppError(malPresupuesto, 409)

    const cambiaEtapa =
      cambios.etapaResponsable !== undefined && cambios.etapaResponsable !== p.etapa_responsable
    if (cambiaEtapa && cambios.etapaResponsable != null) {
      const motivo = motivoEtapaResponsable(cambios.etapaResponsable, await leerContactos(id, tenant, client))
      if (motivo) throw new AppError(motivo, 409)
    }

    const sets: string[] = []
    const params: unknown[] = [id, tenant]
    for (const [clave, col] of COLUMNAS) {
      if (cambios[clave] === undefined) continue
      params.push(cambios[clave])
      sets.push(`${col} = $${params.length}`)
    }
    if (cambios.ubicacion !== undefined) {
      const u = cambios.ubicacion
      params.push(u?.lat ?? null, u?.lng ?? null, u?.origen ?? null, u?.placeId ?? null, u ? usuarioId : null)
      const n = params.length
      sets.push(
        `lat = $${n - 4}`,
        `lng = $${n - 3}`,
        `ubicacion_origen = $${n - 2}`,
        `ubicacion_place_id = $${n - 1}`,
        // La precisión es del GPS, que está pendiente: se limpia al fijar a mano.
        `ubicacion_precision_m = null`,
        `ubicacion_fijada_por = $${n}`,
        `ubicacion_fijada_en = case when $${n}::uuid is null then null else now() end`,
      )
    }
    if (sets.length) {
      await client.query(`update prospectos set ${sets.join(', ')} where id = $1 and tenant_id = $2`, params)
    }

    if (cambiaEtapa) {
      const nombre = (e: number | null) => (e ? ETAPAS_RESPONSABLE[e - 1] : 'sin etapa')
      await insertarAvance(client, {
        tenant,
        prospectoId: id,
        usuarioId,
        anterior: p.etapa,
        nueva: p.etapa,
        nota: `Búsqueda del responsable: ${nombre(p.etapa_responsable)} → ${nombre(cambios.etapaResponsable ?? null)}`,
      })
    }
    return true
  })
}

// ─── Contactos ──────────────────────────────────────────────────────────────

export interface ContactoInput {
  nombre: string
  papel: string | null
  telefono: string | null
  email: string | null
  esLegal: boolean
}

export async function crearContacto(
  id: string,
  c: ContactoInput,
  usuarioId: string,
  soloDe?: string | null,
): Promise<boolean> {
  const tenant = await tenantActual()
  return withTenantTx(async (client) => {
    const p = await bloquear(client, tenant, id, soloDe)
    if (!p) return false
    exigirEdicion(p, 'hijos')
    await client.query(
      `insert into prospecto_contactos (tenant_id, prospecto_id, nombre, papel, telefono, email, es_legal, creado_por)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [tenant, id, c.nombre, c.papel, c.telefono, c.email, c.esLegal, usuarioId],
    )
    return true
  })
}

export async function editarContacto(
  id: string,
  contactoId: string,
  c: Partial<ContactoInput>,
  soloDe?: string | null,
): Promise<boolean> {
  const tenant = await tenantActual()
  return withTenantTx(async (client) => {
    const p = await bloquear(client, tenant, id, soloDe)
    if (!p) return false
    exigirEdicion(p, 'hijos')
    const contactos = await leerContactos(id, tenant, client)
    if (!contactos.some((x) => x.id === contactoId)) return false
    if (c.esLegal === false) {
      const motivo = motivoQuitarLegal(p.etapa_responsable, contactos, contactoId)
      if (motivo) throw new AppError(motivo, 409)
    }
    const campos: [keyof ContactoInput, string][] = [
      ['nombre', 'nombre'], ['papel', 'papel'], ['telefono', 'telefono'], ['email', 'email'], ['esLegal', 'es_legal'],
    ]
    const sets: string[] = []
    const params: unknown[] = [contactoId, id, tenant]
    for (const [k, col] of campos) {
      if (c[k] === undefined) continue
      params.push(c[k])
      sets.push(`${col} = $${params.length}`)
    }
    if (sets.length) {
      await client.query(
        `update prospecto_contactos set ${sets.join(', ')} where id = $1 and prospecto_id = $2 and tenant_id = $3`,
        params,
      )
    }
    return true
  })
}

export async function borrarContacto(id: string, contactoId: string, soloDe?: string | null): Promise<boolean> {
  const tenant = await tenantActual()
  return withTenantTx(async (client) => {
    const p = await bloquear(client, tenant, id, soloDe)
    if (!p) return false
    exigirEdicion(p, 'hijos')
    const contactos = await leerContactos(id, tenant, client)
    if (!contactos.some((x) => x.id === contactoId)) return false
    const motivo = motivoQuitarLegal(p.etapa_responsable, contactos, contactoId)
    if (motivo) throw new AppError(motivo, 409)
    await client.query(
      'delete from prospecto_contactos where id = $1 and prospecto_id = $2 and tenant_id = $3',
      [contactoId, id, tenant],
    )
    return true
  })
}

// ─── Ofertas al dueño ───────────────────────────────────────────────────────

export interface OfertaInput {
  fecha: string | null
  importeMensual: number
  plazoMeses: number
  estado: EstadoOferta
  notas: string | null
}

export async function crearOferta(
  id: string,
  o: OfertaInput,
  usuarioId: string,
  soloDe?: string | null,
): Promise<boolean> {
  const tenant = await tenantActual()
  return withTenantTx(async (client) => {
    const p = await bloquear(client, tenant, id, soloDe)
    if (!p) return false
    exigirEdicion(p, 'hijos')
    // La versión, con el prospecto bloqueado: dos altas a la vez se ponen en
    // fila y salen 2 y 3, no dos 2 (el índice único es la red, no el plan).
    const { rows } = await client.query(
      'select version from prospecto_ofertas where prospecto_id = $1 and tenant_id = $2',
      [id, tenant],
    )
    const version = siguienteVersion(rows.map((r: any) => ({ version: Number(r.version) })))
    await client.query(
      `insert into prospecto_ofertas (tenant_id, prospecto_id, version, fecha, importe_mensual, plazo_meses,
                                      estado, notas, creado_por)
       values ($1,$2,$3,coalesce($4::date, current_date),$5,$6,$7,$8,$9)`,
      [tenant, id, version, o.fecha, o.importeMensual, o.plazoMeses, o.estado, o.notas, usuarioId],
    )
    return true
  })
}

/** Solo el estado y las notas: el importe no se reescribe, se hace otra versión. */
export async function editarOferta(
  id: string,
  ofertaId: string,
  c: { estado?: EstadoOferta; notas?: string | null },
  soloDe?: string | null,
): Promise<boolean> {
  const tenant = await tenantActual()
  return withTenantTx(async (client) => {
    const p = await bloquear(client, tenant, id, soloDe)
    if (!p) return false
    exigirEdicion(p, 'hijos')
    const { rows } = await client.query(
      'select estado from prospecto_ofertas where id = $1 and prospecto_id = $2 and tenant_id = $3 for update',
      [ofertaId, id, tenant],
    )
    if (!rows[0]) return false
    if (c.estado) {
      const motivo = motivoCambioOferta(rows[0].estado, c.estado)
      if (motivo) throw new AppError(motivo, 409)
    }
    await client.query(
      `update prospecto_ofertas
          set estado = coalesce($4, estado),
              notas = case when $5::boolean then $6 else notas end
        where id = $1 and prospecto_id = $2 and tenant_id = $3`,
      [ofertaId, id, tenant, c.estado ?? null, c.notas !== undefined, c.notas ?? null],
    )
    return true
  })
}

// ─── Competencia ────────────────────────────────────────────────────────────

export interface CompetidorInput {
  nombre: string
  nota: string | null
  desde: string | null
}

export async function crearCompetidor(
  id: string,
  c: CompetidorInput,
  usuarioId: string,
  soloDe?: string | null,
): Promise<boolean> {
  const tenant = await tenantActual()
  return withTenantTx(async (client) => {
    const p = await bloquear(client, tenant, id, soloDe)
    if (!p) return false
    exigirEdicion(p, 'hijos')
    await client.query(
      `insert into prospecto_competencia (tenant_id, prospecto_id, nombre, nota, desde, creado_por)
       values ($1,$2,$3,$4,$5::date,$6)`,
      [tenant, id, c.nombre, c.nota, c.desde, usuarioId],
    )
    return true
  })
}

export async function editarCompetidor(
  id: string,
  competidorId: string,
  c: Partial<CompetidorInput>,
  soloDe?: string | null,
): Promise<boolean> {
  const tenant = await tenantActual()
  return withTenantTx(async (client) => {
    const p = await bloquear(client, tenant, id, soloDe)
    if (!p) return false
    exigirEdicion(p, 'hijos')
    const { rowCount } = await client.query(
      `update prospecto_competencia
          set nombre = coalesce($4, nombre),
              nota = case when $5::boolean then $6 else nota end,
              desde = case when $7::boolean then $8::date else desde end
        where id = $1 and prospecto_id = $2 and tenant_id = $3`,
      [competidorId, id, tenant, c.nombre ?? null, c.nota !== undefined, c.nota ?? null, c.desde !== undefined, c.desde ?? null],
    )
    return (rowCount ?? 0) > 0
  })
}

export async function borrarCompetidor(id: string, competidorId: string, soloDe?: string | null): Promise<boolean> {
  const tenant = await tenantActual()
  return withTenantTx(async (client) => {
    const p = await bloquear(client, tenant, id, soloDe)
    if (!p) return false
    exigirEdicion(p, 'hijos')
    const { rowCount } = await client.query(
      'delete from prospecto_competencia where id = $1 and prospecto_id = $2 and tenant_id = $3',
      [competidorId, id, tenant],
    )
    return (rowCount ?? 0) > 0
  })
}

// ─── Notas ──────────────────────────────────────────────────────────────────

/** Una nota más. Se puede siempre, también en un espacio perdido. */
export async function crearNota(id: string, texto: string, usuarioId: string, soloDe?: string | null): Promise<boolean> {
  const tenant = await tenantActual()
  return withTenantTx(async (client) => {
    const p = await bloquear(client, tenant, id, soloDe)
    if (!p) return false
    exigirEdicion(p, 'notas')
    await client.query(
      'insert into prospecto_notas (tenant_id, prospecto_id, usuario_id, texto) values ($1,$2,$3,$4)',
      [tenant, id, usuarioId, texto],
    )
    return true
  })
}
