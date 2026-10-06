import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  El tablero de propuestas por periodo, contra Postgres real (PROP-PER, 06/10).
//
//  Lo que las unitarias no ven:
//    · que aprobar y rechazar por la API DEJEN SU FECHA, que es lo que cuenta
//      el tablero;
//    · que la renta salga del CONTRATO de la pantalla, por sus meses;
//    · que quien no ve finanzas no reciba ni el costo ni la ganancia;
//    · que la migración feche las aprobadas que ya existían.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let otra: Awaited<ReturnType<typeof sembrarTenant>>
let dueno: Cliente
let vendedor: Cliente

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('proptab')
  otra = await sembrarTenant('proptabotra')
  await poolTest().query(
    `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
     values ('Víctor', 'vendedor@proptab.test', 'VENDEDOR', $1, true, $2)`,
    [await bcrypt.hash(PASSWORD_DEMO, 4), org.id],
  )
  await arrancarServidor()
  dueno = new Cliente()
  await dueno.entrar(org.usuarioEmail, PASSWORD_DEMO)
  vendedor = new Cliente()
  await vendedor.entrar('vendedor@proptab.test', PASSWORD_DEMO)
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

let n = 0
// Una propuesta con UNA pantalla (la del contrato de 20 000 al mes) por DOS
// meses de calendario: la renta que le toca es 40 000.
async function propuesta(t: { id: string; clienteId: string; sitioId: string }, estatus = 'ENVIADA') {
  n++
  const p = await poolTest().query(
    `insert into propuestas (folio, cliente_id, nombre, fecha, estatus, comision_pct, descuento_pct, tenant_id)
     values ($1, $2, $3, current_date, $4::est_propuesta, 0, 0, $5) returning id`,
    [`PT-${n}`, t.clienteId, `Propuesta ${n}`, estatus, t.id],
  )
  await poolTest().query(
    `insert into propuesta_items (propuesta_id, sitio_id, fecha_inicio, fecha_fin, precio, unidad, cantidad,
                                  tarifa_unitaria, aprobado, tenant_id)
     values ($1, $2, '2026-11-01', '2026-12-31', 150000, 'mensual', 2, 75000, true, $3)`,
    [p.rows[0].id, t.sitioId, t.id],
  )
  return p.rows[0].id as string
}
const fechas = async (id: string) =>
  (
    await poolTest().query(
      `select to_char(aprobada_en, 'YYYY-MM-DD') as aprobada, to_char(rechazada_en, 'YYYY-MM-DD') as rechazada,
              (snapshot_economico->>'neto')::float as neto
         from propuestas where id = $1`,
      [id],
    )
  ).rows[0]
const hoy = async () => (await poolTest().query(`select to_char(current_date, 'YYYY-MM-DD') d`)).rows[0].d

let aprobada = ''
let rechazada = ''

describe('1 · aprobar y rechazar dejan su fecha', () => {
  it('rechazar pone rechazada_en hoy', async () => {
    rechazada = await propuesta(org)
    const r = await dueno.pedir(`/api/propuestas/${rechazada}/`, { metodo: 'PATCH', cuerpo: { estatus: 'RECHAZADA' } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(await fechas(rechazada)).toMatchObject({ rechazada: await hoy(), aprobada: null })
  })

  it('aprobar pone aprobada_en hoy y congela el precio', async () => {
    aprobada = await propuesta(org)
    const r = await dueno.pedir(`/api/propuestas/${aprobada}/`, { metodo: 'PATCH', cuerpo: { estatus: 'APROBADA' } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    const f = await fechas(aprobada)
    expect(f.aprobada).toBe(await hoy())
    expect(f.rechazada).toBeNull()
    expect(f.neto).toBeGreaterThan(0)
  })

  it('una rechazada que se reabre pierde su fecha de rechazo', async () => {
    const id = await propuesta(org)
    await dueno.pedir(`/api/propuestas/${id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'RECHAZADA' } })
    await dueno.pedir(`/api/propuestas/${id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'ENVIADA' } })
    expect(await fechas(id)).toMatchObject({ aprobada: null, rechazada: null })
    // Y no se queda contada: la limpiamos para no ensuciar el conteo de abajo.
    await poolTest().query('delete from propuestas where id = $1', [id])
  })
})

describe('2 · el tablero', () => {
  it('con permiso de finanzas: conteos, venta, renta del contrato y ganancia', async () => {
    // Una de la OTRA organización, aprobada hoy: no puede aparecer.
    const ajena = await propuesta(otra, 'APROBADA')
    await poolTest().query(`update propuestas set aprobada_en = now() where id = $1`, [ajena])

    const r = await dueno.pedir('/api/propuestas/resumen/?periodo=mes')
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    const { resumen, conGanancia } = r.datos
    expect(conGanancia).toBe(true)
    expect(resumen.generadas).toBe(2)
    expect(resumen.rechazadas).toBe(1)
    expect(resumen.aprobadas.n).toBe(1)
    const venta = (await fechas(aprobada)).neto
    expect(resumen.aprobadas.venta).toBeCloseTo(venta, 2)
    // 20 000 al mes × 2 meses de calendario (nov y dic).
    expect(resumen.aprobadas.costo).toBe(40000)
    expect(resumen.aprobadas.ganancia).toBeCloseTo(venta - 40000, 2)
    expect(resumen.tasaCierre).toBeCloseTo(0.5)
    expect(resumen.lista.map((x: any) => x.id)).toEqual([aprobada])
  })

  it('el vendedor ve los conteos y la venta, pero NO el costo ni la ganancia', async () => {
    const r = await vendedor.pedir('/api/propuestas/resumen/?periodo=mes')
    expect(r.status).toBe(200)
    expect(r.datos.conGanancia).toBe(false)
    expect(r.datos.resumen.aprobadas.n).toBe(1)
    expect(r.datos.resumen.aprobadas.costo).toBeNull()
    expect(r.datos.resumen.aprobadas.ganancia).toBeNull()
    expect(r.datos.resumen.lista[0].costoRenta).toBeNull()
    expect(r.datos.resumen.lista[0].ganancia).toBeNull()
    expect(JSON.stringify(r.datos)).not.toContain('40000')
  })

  it('un periodo desconocido es 400, y sin sesión no hay tablero', async () => {
    expect((await dueno.pedir('/api/propuestas/resumen/?periodo=siglo')).status).toBe(400)
    expect((await new Cliente().pedir('/api/propuestas/resumen/?periodo=mes')).status).toBe(401)
  })
})

describe('3 · la migración fecha las aprobadas que ya existían', () => {
  it('aprobada_en = cuando se congeló su precio, y las rechazadas viejas quedan sin fecha', async () => {
    const vieja = await propuesta(org, 'APROBADA')
    const rech = await propuesta(org, 'RECHAZADA')
    await poolTest().query(
      `update propuestas set aprobada_en = null, snapshot_en = '2026-08-14 12:00-06' where id = $1`,
      [vieja],
    )
    const sql = readFileSync(join(process.cwd(), '../../db/migrations/20261009_propuestas_fechas_estatus.sql'), 'utf8')
    await poolTest().query(sql)
    expect((await fechas(vieja)).aprobada).toBe('2026-08-14')
    expect((await fechas(rech)).rechazada).toBeNull()
    // Idempotente.
    await poolTest().query(sql)
    expect((await fechas(vieja)).aprobada).toBe('2026-08-14')
  })
})
