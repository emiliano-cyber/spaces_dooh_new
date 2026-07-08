import 'server-only'
import { randomBytes } from 'crypto'
import { q, q1, pool } from './db'
import { tenantActual } from './tenant'

// Error de regla de negocio (propuesta inmutable) → el route lo mapea a 409.
export class PropuestaError extends Error {}

// Bloqueo por negociación: si la agencia tiene negociación SIN validar, no se
// puede crear ni aprobar una propuesta con esa agencia (gate de validación).
async function agenciaBloqueada(
  agenciaId: string | null | undefined,
): Promise<{ bloqueada: boolean; nombre?: string }> {
  if (!agenciaId) return { bloqueada: false }
  const a = await q1<any>(
    'select nombre, tiene_negociacion, negociacion_validada from clientes where id=$1',
    [agenciaId],
  )
  if (!a) return { bloqueada: false }
  return { bloqueada: !!a.tiene_negociacion && !a.negociacion_validada, nombre: a.nombre }
}

// ============================================================================
//  lib/server/propuestas-repo.ts — Propuestas comerciales con método del
//  divisor. bruto = Σ items; divisor = 1 − comisión/100; neto = bruto × divisor;
//  iva = bruto × 16%; total = bruto + iva.
// ============================================================================

const IVA_PCT = 16
const iso = (v: any) => (v instanceof Date ? v.toISOString() : v)
const folio = () => `PR-${randomBytes(3).toString('hex').toUpperCase()}`

function rowToItem(r: any) {
  return {
    id: r.id,
    propuestaId: r.propuesta_id,
    sitioId: r.sitio_id,
    fechaInicio: iso(r.fecha_inicio),
    fechaFin: iso(r.fecha_fin),
    precio: Number(r.precio),
    aprobado: !!r.aprobado,
  }
}

function armarPropuesta(p: any, items: any[]) {
  const its = items.map(rowToItem)
  const bruto = its.reduce((s, i) => s + i.precio, 0)
  const comisionPct = Number(p.comision_pct)
  const descuentoPct = p.descuento_pct != null ? Number(p.descuento_pct) : 0
  const version = p.version != null ? Number(p.version) : 1
  const divisor = 1 - comisionPct / 100
  // IVA configurado en el cliente (clientes.iva_pct); si no viene, 16.
  const ivaP = p.cliente_iva != null ? Number(p.cliente_iva) : IVA_PCT

  // base = tarifa de lista (bruto) − descuento comercial. El neto (para el
  // medio) y el IVA se calculan sobre la base; el total es lo que paga el cliente.
  const descuentoMonto = Math.round(bruto * (descuentoPct / 100))
  const base = bruto - descuentoMonto
  const neto = Math.round(base * divisor)
  const iva = Math.round(base * (ivaP / 100))
  // Aprobación granular: presupuesto sobre los items aprobados (modelo "menú").
  const aprob = its.filter((i) => i.aprobado)
  const brutoAprobado = aprob.reduce((s, i) => s + i.precio, 0)
  const baseAprobado = brutoAprobado - Math.round(brutoAprobado * (descuentoPct / 100))
  const netoAprobado = Math.round(baseAprobado * divisor)
  const ivaAprobado = Math.round(baseAprobado * (ivaP / 100))
  return {
    id: p.id,
    folio: p.folio,
    clienteId: p.cliente_id ?? null,
    agenciaId: p.agencia_id ?? null,
    nombre: p.nombre,
    fecha: iso(p.fecha),
    estatus: p.estatus,
    comisionPct,
    descuentoPct,
    version,
    notas: p.notas ?? null,
    creadoEn: iso(p.creado_en),
    items: its,
    bruto,
    descuentoMonto,
    base,
    divisor,
    neto,
    iva,
    total: base + iva,
    itemsAprobados: aprob.length,
    brutoAprobado,
    baseAprobado,
    netoAprobado,
    ivaAprobado,
    totalAprobado: baseAprobado + ivaAprobado,
  }
}

// S0-1: congela un snapshot económico INMUTABLE al aceptar/aprobar. Todos los
// módulos (campaña, factura, rentabilidad, comisiones) leen de aquí — nadie
// recalcula desde tarifas de lista. Idempotente: si ya existe, no lo re-escribe.
// Devuelve el snapshot (nuevo o el existente).
export async function congelarSnapshotEconomico(propuestaId: string) {
  const prop = await q1<any>(
    `select p.*, c.iva_pct as cliente_iva
       from propuestas p left join clientes c on c.id = p.cliente_id
      where p.id = $1`,
    [propuestaId],
  )
  if (!prop) return null
  if (prop.snapshot_economico) return prop.snapshot_economico // inmutable

  const aprob = await q<any>(
    'select * from propuesta_items where propuesta_id=$1 and aprobado=true order by creado_en asc',
    [propuestaId],
  )
  const usar = aprob.length
    ? aprob
    : await q<any>('select * from propuesta_items where propuesta_id=$1', [propuestaId])

  const comisionPct = Number(prop.comision_pct)
  const descuentoPct = prop.descuento_pct != null ? Number(prop.descuento_pct) : 0
  const ivaPct = prop.cliente_iva != null ? Number(prop.cliente_iva) : IVA_PCT
  const version = prop.version != null ? Number(prop.version) : 1
  const divisor = 1 - comisionPct / 100
  const factorDesc = 1 - descuentoPct / 100

  const bruto = usar.reduce((s, it) => s + Number(it.precio), 0)
  const descuentoMonto = Math.round(bruto * (descuentoPct / 100))
  const base = bruto - descuentoMonto
  const neto = Math.round(base * divisor)
  const iva = Math.round(base * (ivaPct / 100))
  const total = base + iva
  const porSitio = usar.map((it) => ({
    sitioId: it.sitio_id,
    lista: Number(it.precio),
    neto: Math.round(Number(it.precio) * factorDesc * divisor),
  }))

  const snap = { version, bruto, descuentoPct, descuentoMonto, base, comisionPct, neto, ivaPct, iva, total, porSitio }
  await q('update propuestas set snapshot_economico=$2, snapshot_en=now() where id=$1', [
    propuestaId,
    JSON.stringify(snap),
  ])
  return snap
}

// Lectura pública (sin auth) de una propuesta por su CÓDIGO: acepta el id (UUID)
// o el folio (p. ej. PR-A0BC4F). Datos de solo lectura para una liga
// compartible. Incluye nombres de cliente/agencia y de cada sitio.
export async function obtenerPropuestaPublica(codigo: string) {
  const cod = (codigo ?? '').trim()
  // Se compara el código contra el id (UUID, casteado a texto) o el folio. Se
  // castea la COLUMNA a texto para no fallar si el código no es un UUID válido.
  const p = await q1<any>(
    `select p.*, (select iva_pct from clientes c where c.id = p.cliente_id) as cliente_iva
       from propuestas p
      where p.id::text = $1 or upper(p.folio) = upper($1)
      limit 1`,
    [cod],
  )
  if (!p) return null
  const id = p.id
  const items = await q('select * from propuesta_items where propuesta_id=$1 order by creado_en asc', [id])
  const armado = armarPropuesta(p, items)

  const cliente = p.cliente_id ? await q1<any>('select nombre from clientes where id=$1', [p.cliente_id]) : null
  const agencia = p.agencia_id ? await q1<any>('select nombre from clientes where id=$1', [p.agencia_id]) : null

  const sitioIds = (items as any[]).map((i) => i.sitio_id)
  const sitios = sitioIds.length
    ? await q<any>('select id, nombre, alcaldia, tipo_medio, lat, lng from sitios where id = any($1::uuid[])', [sitioIds])
    : []
  const byId = new Map(sitios.map((s) => [s.id, s]))

  return {
    folio: armado.folio,
    nombre: armado.nombre,
    estatus: armado.estatus,
    aceptadoEn: p.aceptado_en ? iso(p.aceptado_en) : null,
    aceptadoPor: p.aceptado_por ?? null,
    version: armado.version,
    clienteNombre: cliente?.nombre ?? null,
    agenciaNombre: agencia?.nombre ?? null,
    comisionPct: armado.comisionPct,
    descuentoPct: armado.descuentoPct,
    descuentoMonto: armado.descuentoMonto,
    divisor: armado.divisor,
    bruto: armado.bruto,
    base: armado.base,
    neto: armado.neto,
    iva: armado.iva,
    total: armado.total,
    itemsAprobados: armado.itemsAprobados,
    items: armado.items.map((it) => {
      const s = byId.get(it.sitioId)
      return {
        sitioNombre: s?.nombre ?? it.sitioId,
        alcaldia: s?.alcaldia ?? null,
        tipoMedio: s?.tipo_medio ?? null,
        lat: s?.lat != null ? Number(s.lat) : null,
        lng: s?.lng != null ? Number(s.lng) : null,
        fechaInicio: it.fechaInicio,
        fechaFin: it.fechaFin,
        precio: it.precio,
        aprobado: it.aprobado,
      }
    }),
  }
}

// ─── Aceptación del cliente desde la liga pública ───────────────────────────
// El cliente acepta la propuesta con un clic desde la liga (SIN sesión). Deja
// el timestamp + su nombre (medio-contrato) y mueve la propuesta a APROBADA
// (acepta todas las pantallas si no hay selección granular). Idempotente: si ya
// está aceptada, devuelve la aceptación existente sin volver a escribir.
// Nota: NO re-valida el gate de negociación de agencia — enviar la liga al
// cliente (ENVIADA) ya fue un acto deliberado del área comercial.
export async function aceptarPropuestaPublica(
  codigo: string,
  input: { nombre: string; ip?: string | null },
): Promise<{ ok: boolean; yaAceptada: boolean; estatus: string; aceptadoEn: string | null; aceptadoPor: string | null } | null> {
  const cod = (codigo ?? '').trim()
  const nombre = (input.nombre ?? '').trim()
  if (!nombre) throw new PropuestaError('Escribe tu nombre para aceptar la propuesta')

  const p = await q1<any>(
    `select id, tenant_id, folio, nombre, estatus, aceptado_en, aceptado_por
       from propuestas where id::text = $1 or upper(folio) = upper($1) limit 1`,
    [cod],
  )
  if (!p) return null

  // Idempotente: ya aceptada / aprobada → devuelve la aceptación registrada.
  if (p.aceptado_en || p.estatus === 'APROBADA') {
    return {
      ok: true,
      yaAceptada: true,
      estatus: p.estatus,
      aceptadoEn: p.aceptado_en ? iso(p.aceptado_en) : null,
      aceptadoPor: p.aceptado_por ?? null,
    }
  }
  if (p.estatus === 'BORRADOR') {
    throw new PropuestaError('Esta propuesta todavía no está disponible para aceptar')
  }
  if (p.estatus === 'RECHAZADA') {
    throw new PropuestaError('Esta propuesta ya no está vigente')
  }

  const client = await pool.connect()
  try {
    await client.query('begin')
    // Aceptar = aceptar todas las pantallas si no hay selección granular previa.
    const marcados = (
      await client.query(
        'select count(*)::int as n from propuesta_items where propuesta_id=$1 and aprobado=true',
        [p.id],
      )
    ).rows[0].n
    if (Number(marcados) === 0) {
      await client.query('update propuesta_items set aprobado=true where propuesta_id=$1', [p.id])
    }
    const upd = (
      await client.query(
        `update propuestas
            set estatus='APROBADA', aceptado_en=now(), aceptado_por=$2, aceptado_ip=$3
          where id=$1
          returning estatus, aceptado_en, aceptado_por`,
        [p.id, nombre, input.ip ?? null],
      )
    ).rows[0]
    // Notifica al equipo interno (bell) usando el tenant de la propuesta, no la
    // sesión (aquí no hay sesión). Nunca rompe la aceptación si falla.
    try {
      await client.query(
        `insert into notificaciones (tipo, nivel, titulo, detalle, link, tenant_id)
         values ('PROPUESTA','ok',$1,$2,$3,$4)`,
        [
          'Propuesta aceptada por el cliente',
          `${p.folio} · ${p.nombre} — aceptada por ${nombre}`,
          `/demo/propuestas/${p.id}`,
          p.tenant_id,
        ],
      )
    } catch { /* la notificación no rompe la aceptación */ }
    await client.query('commit')
    // S0-1: congela el snapshot económico al aceptar por liga pública (inmutable).
    await congelarSnapshotEconomico(p.id)
    return {
      ok: true,
      yaAceptada: false,
      estatus: upd.estatus,
      aceptadoEn: iso(upd.aceptado_en),
      aceptadoPor: upd.aceptado_por,
    }
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}

export async function listarPropuestas() {
  const props = await q(
    `select p.*, (select iva_pct from clientes c where c.id = p.cliente_id) as cliente_iva
       from propuestas p where p.tenant_id = $1 order by p.creado_en desc`,
    [await tenantActual()],
  )
  if (!props.length) return []
  const items = await q('select * from propuesta_items order by creado_en asc')
  const porProp = new Map<string, any[]>()
  for (const it of items) {
    const arr = porProp.get(it.propuesta_id) ?? []
    arr.push(it)
    porProp.set(it.propuesta_id, arr)
  }
  return props.map((p: any) => armarPropuesta(p, porProp.get(p.id) ?? []))
}

export interface PropuestaInput {
  clienteId?: string | null
  agenciaId?: string | null
  nombre: string
  comisionPct?: number
  fechaInicio: string
  fechaFin: string
  // Sitios con su precio (tarifa de lista). Si no viene precio, se toma 0.
  items: { sitioId: string; precio: number }[]
  notas?: string | null
}

// S1-1: valida que la fecha fin no sea anterior a la de inicio (rango válido).
export function validarRangoFechas(inicio?: string | null, fin?: string | null) {
  if (!inicio || !fin) return
  if (new Date(fin) < new Date(inicio)) {
    throw new PropuestaError('La fecha fin no puede ser anterior a la fecha de inicio')
  }
}

export async function crearPropuesta(input: PropuestaInput) {
  validarRangoFechas(input.fechaInicio, input.fechaFin)
  // Gate de negociación: la agencia debe tener su negociación validada.
  const bloq = await agenciaBloqueada(input.agenciaId)
  if (bloq.bloqueada) {
    throw new PropuestaError(
      `La negociación con la agencia ${bloq.nombre ?? ''} no está validada; valídala antes de crear la propuesta`,
    )
  }
  const client = await pool.connect()
  try {
    await client.query('begin')
    const prop = (
      await client.query(
        `insert into propuestas (folio, cliente_id, agencia_id, nombre, comision_pct, notas, tenant_id)
         values ($1,$2,$3,$4,$5,$6,$7) returning *`,
        [folio(), input.clienteId ?? null, input.agenciaId ?? null, input.nombre, input.comisionPct ?? 0, input.notas ?? null, await tenantActual()],
      )
    ).rows[0]
    // Siempre asociar la agencia con el cliente: si la propuesta lleva cliente y
    // agencia, se persiste el vínculo en el cliente para que quede ligado y se
    // precargue en futuras propuestas.
    if (input.clienteId && input.agenciaId) {
      await client.query('update clientes set agencia_id=$2 where id=$1', [
        input.clienteId,
        input.agenciaId,
      ])
    }
    for (const it of input.items) {
      await client.query(
        `insert into propuesta_items (propuesta_id, sitio_id, fecha_inicio, fecha_fin, precio, tenant_id)
         values ($1,$2,$3,$4,$5,$6)`,
        [prop.id, it.sitioId, input.fechaInicio, input.fechaFin, it.precio ?? 0, await tenantActual()],
      )
    }
    const items = (
      await client.query('select * from propuesta_items where propuesta_id=$1', [prop.id])
    ).rows
    await client.query('commit')
    return armarPropuesta(prop, items)
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}

// Aprobación granular: aprueba/desaprueba un sitio (item) de la propuesta y
// devuelve la propuesta recompuesta (con los totales aprobados al día).
export async function aprobarItem(itemId: string, aprobado: boolean) {
  // Congelado: una propuesta ya APROBADA es inmutable; sus ítems no se editan.
  const est = await q1<any>(
    `select p.estatus from propuesta_items i join propuestas p on p.id=i.propuesta_id where i.id=$1`,
    [itemId],
  )
  if (est?.estatus === 'APROBADA') {
    throw new PropuestaError('La propuesta ya está aprobada y es inmutable; un cambio va como adenda')
  }
  const upd = await q(
    `update propuesta_items set aprobado=$2 where id=$1 returning propuesta_id`,
    [itemId, aprobado],
  )
  if (!upd.length) return null
  const propId = upd[0].propuesta_id
  const p = (await q('select * from propuestas where id=$1', [propId]))[0]
  const items = await q('select * from propuesta_items where propuesta_id=$1', [propId])
  return armarPropuesta(p, items)
}

// Actualiza campos editables de la propuesta (descuento comercial, nombre,
// notas). Regla de negocio: una propuesta APROBADA es inmutable. Si se cambia
// el descuento de una propuesta ya ENVIADA, sube la versión (renegociación).
export async function actualizarPropuesta(
  id: string,
  input: { descuentoPct?: number; nombre?: string; notas?: string | null },
) {
  const cur = await q1<any>('select estatus, descuento_pct from propuestas where id=$1', [id])
  if (!cur) return null
  if (cur.estatus === 'APROBADA') {
    throw new PropuestaError('La propuesta ya está aprobada y es inmutable; un cambio va como adenda')
  }
  const sets: string[] = []
  const vals: any[] = [id]
  let i = 2
  let subeVersion = false
  if (input.descuentoPct != null) {
    const d = Math.max(0, Math.min(100, Number(input.descuentoPct)))
    sets.push(`descuento_pct=$${i++}`)
    vals.push(d)
    if (cur.estatus === 'ENVIADA' && d !== Number(cur.descuento_pct)) subeVersion = true
  }
  if (input.nombre != null) { sets.push(`nombre=$${i++}`); vals.push(input.nombre) }
  if (input.notas !== undefined) { sets.push(`notas=$${i++}`); vals.push(input.notas) }
  if (subeVersion) sets.push('version = version + 1')
  if (sets.length) await q(`update propuestas set ${sets.join(', ')} where id=$1`, vals)

  const p = await q1<any>(
    'select p.*, (select iva_pct from clientes c where c.id = p.cliente_id) as cliente_iva from propuestas p where p.id=$1',
    [id],
  )
  const items = await q('select * from propuesta_items where propuesta_id=$1', [id])
  return armarPropuesta(p, items)
}

// S1-2: aprobar una propuesta con Total $0 (p. ej. descuento 100%) exige
// confirmación explícita. El route la mapea a un aviso; el UI reconfirma.
export class PropuestaCeroError extends PropuestaError {}

const ESTATUS_VALIDOS = ['BORRADOR', 'ENVIADA', 'APROBADA', 'RECHAZADA']
export async function cambiarEstatusPropuesta(
  id: string,
  estatus: string,
  opts?: { confirmarCero?: boolean },
) {
  if (!ESTATUS_VALIDOS.includes(estatus)) throw new Error('Estatus inválido')
  // Aprobar exige que la negociación con la agencia esté validada.
  if (estatus === 'APROBADA') {
    const p = await q1<any>('select agencia_id from propuestas where id=$1', [id])
    const bloq = await agenciaBloqueada(p?.agencia_id)
    if (bloq.bloqueada) {
      throw new PropuestaError(
        `La negociación con la agencia ${bloq.nombre ?? ''} no está validada; no se puede aprobar la propuesta`,
      )
    }
    // S1-2: guardarraíl contra aprobar/facturar en $0 sin confirmación.
    const tot = await q1<{ base: string }>(
      `select coalesce(sum(precio),0) * (1 - coalesce((select descuento_pct from propuestas where id=$1),0)/100.0) as base
         from propuesta_items where propuesta_id=$1`,
      [id],
    )
    if (Number(tot?.base ?? 0) <= 0 && !opts?.confirmarCero) {
      throw new PropuestaCeroError('Estás por aprobar una propuesta con Total $0. Confirma explícitamente para continuar.')
    }
    // Aprobar la propuesta = aceptar sus pantallas. Si no hay ítems marcados,
    // se aprueban TODOS (la campaña se genera sobre todas las pantallas).
    const aprob = await q1<{ n: string }>(
      'select count(*)::text as n from propuesta_items where propuesta_id=$1 and aprobado=true',
      [id],
    )
    if (Number(aprob?.n ?? 0) === 0) {
      await q('update propuesta_items set aprobado=true where propuesta_id=$1', [id])
    }
  }
  const rows = await q(
    `update propuestas set estatus=$2::est_propuesta where id=$1 returning *`,
    [id, estatus],
  )
  if (!rows.length) return null
  // S0-1: al aprobar se congela el snapshot económico (inmutable).
  if (estatus === 'APROBADA') await congelarSnapshotEconomico(id)
  const items = await q('select * from propuesta_items where propuesta_id=$1', [id])
  return armarPropuesta(rows[0], items)
}
