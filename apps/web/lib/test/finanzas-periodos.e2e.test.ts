import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { recrearEsquema, cerrarPool, poolTest, poolApp } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  Finanzas por periodo, contra Postgres real (FIN-PER, ADR 0046).
//
//  Lo que las unitarias no pueden ver:
//    · que cada pago deje su renglón en `cobranza_abonos` bajo la RLS, con la
//      fecha y quién, y que `monto_pagado` siga siendo la suma de sus abonos;
//    · que dos pagos a la vez (el doble clic) no cobren dos veces;
//    · que el tablero y el estado de cuenta solo cuenten lo de su organización;
//    · que el rescate de la migración feche lo ya cobrado con la bitácora.
//
//  Las facturas se siembran directo en la base: facturar de verdad exige una
//  campaña aprobada con evidencia, y eso ya lo cubre `flujo-critico`. Aquí lo
//  que se prueba es lo que pasa DESPUÉS de emitir.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let otra: Awaited<ReturnType<typeof sembrarTenant>>
let c: Cliente
let dueno: string

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('finper')
  otra = await sembrarTenant('finotra')
  await arrancarServidor()
  c = new Cliente()
  await c.entrar(org.usuarioEmail, PASSWORD_DEMO)
  // Pagar es un cambio sensible: hay que desbloquear una vez.
  await c.pedir('/api/cambios/desbloquear/', { cuerpo: { password: PASSWORD_DEMO } })
  dueno = (await poolTest().query('select id from usuarios where email = $1', [org.usuarioEmail])).rows[0].id
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

let n = 0
async function factura(
  tenant: { id: string; clienteId: string },
  monto: number,
  emision: string,
  vence: string,
  estatus = 'EMITIDA',
): Promise<{ factura: string; cobranza: string; folio: string }> {
  n++
  const camp = await poolTest().query(
    `insert into campanas (nombre, cliente_id, fecha_inicio, fecha_fin, tenant_id)
     values ($1, $2, $3, $4, $5) returning id`,
    [`Campaña ${n}`, tenant.clienteId, emision, vence, tenant.id],
  )
  const folio = `FP-${String(n).padStart(3, '0')}`
  const f = await poolTest().query(
    `insert into facturas (folio, campana_id, cliente_id, subtotal, igv, monto, fecha_emision, estatus, tenant_id)
     values ($1, $2, $3, $4, 0, $4, $5, $6::est_factura, $7) returning id`,
    [folio, camp.rows[0].id, tenant.clienteId, monto, emision, estatus, tenant.id],
  )
  const cob = await poolTest().query(
    `insert into cobranzas (factura_id, fecha_vencimiento, tenant_id) values ($1, $2, $3) returning id`,
    [f.rows[0].id, vence, tenant.id],
  )
  return { factura: f.rows[0].id, cobranza: cob.rows[0].id, folio }
}

async function abonosDe(cobranza: string) {
  return (
    await poolTest().query(
      `select monto::float as monto, to_char(fecha, 'YYYY-MM-DD') as fecha, origen, usuario_id
         from cobranza_abonos where cobranza_id = $1 order by creado_en`,
      [cobranza],
    )
  ).rows
}
async function pagado(cobranza: string): Promise<number> {
  return Number((await poolTest().query('select monto_pagado from cobranzas where id = $1', [cobranza])).rows[0].monto_pagado)
}
const hoy = async (): Promise<string> =>
  (await poolTest().query(`select to_char(current_date, 'YYYY-MM-DD') as d`)).rows[0].d

describe('1 · cada pago deja su renglón, con fecha y quién', () => {
  it('un abono con fecha se guarda con esa fecha y la persona de la sesión', async () => {
    const { cobranza } = await factura(org, 1000, '2026-09-01', '2026-10-01')
    const r = await c.pedir(`/api/cobranzas/${cobranza}/pagar/`, { cuerpo: { monto: 400, fecha: '2026-09-20' } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(await abonosDe(cobranza)).toEqual([{ monto: 400, fecha: '2026-09-20', origen: 'registro', usuario_id: dueno }])
    expect(await pagado(cobranza)).toBe(400)
  })

  it('sin fecha, el pago es de HOY', async () => {
    const { cobranza } = await factura(org, 1000, '2026-09-01', '2026-10-01')
    await c.pedir(`/api/cobranzas/${cobranza}/pagar/`, { cuerpo: { monto: 100 } })
    expect((await abonosDe(cobranza))[0].fecha).toBe(await hoy())
  })

  it('abonar y liquidar deja dos renglones que suman lo pagado, y la factura PAGADA', async () => {
    const { cobranza, factura: fid } = await factura(org, 1000, '2026-09-01', '2026-10-01')
    await c.pedir(`/api/cobranzas/${cobranza}/pagar/`, { cuerpo: { monto: 300, fecha: '2026-09-10' } })
    await c.pedir(`/api/cobranzas/${cobranza}/pagar/`, { cuerpo: { fecha: '2026-09-25' } })
    const a = await abonosDe(cobranza)
    expect(a.map((x) => [x.monto, x.fecha])).toEqual([[300, '2026-09-10'], [700, '2026-09-25']])
    expect(await pagado(cobranza)).toBe(1000)
    const est = await poolTest().query('select estatus::text from facturas where id = $1', [fid])
    expect(est.rows[0].estatus).toBe('PAGADA')
  })
})

describe('2 · lo que el pago NO permite', () => {
  it('pagar lo ya pagado es un 409 y no deja un abono de 0', async () => {
    const { cobranza } = await factura(org, 500, '2026-09-01', '2026-10-01')
    await c.pedir(`/api/cobranzas/${cobranza}/pagar/`, { cuerpo: {} })
    const r = await c.pedir(`/api/cobranzas/${cobranza}/pagar/`, { cuerpo: {} })
    expect(r.status).toBe(409)
    expect(await abonosDe(cobranza)).toHaveLength(1)
  })

  it('una fecha futura es un 400 y no se escribe nada', async () => {
    const { cobranza } = await factura(org, 500, '2026-09-01', '2026-10-01')
    const r = await c.pedir(`/api/cobranzas/${cobranza}/pagar/`, { cuerpo: { monto: 100, fecha: '2999-01-01' } })
    expect(r.status).toBe(400)
    expect(await abonosDe(cobranza)).toHaveLength(0)
    expect(await pagado(cobranza)).toBe(0)
  })

  it('dos pagos a la vez (el doble clic) no cobran dos veces', async () => {
    const { cobranza } = await factura(org, 800, '2026-09-01', '2026-10-01')
    const [a, b] = await Promise.all([
      c.pedir(`/api/cobranzas/${cobranza}/pagar/`, { cuerpo: {} }),
      c.pedir(`/api/cobranzas/${cobranza}/pagar/`, { cuerpo: {} }),
    ])
    expect([a.status, b.status].sort()).toEqual([200, 409])
    expect(await pagado(cobranza)).toBe(800)
    expect((await abonosDe(cobranza)).reduce((s, x) => s + x.monto, 0)).toBe(800)
  })

  it('la cobranza de otra organización no se puede pagar desde aquí', async () => {
    const { cobranza } = await factura(otra, 500, '2026-09-01', '2026-10-01')
    const r = await c.pedir(`/api/cobranzas/${cobranza}/pagar/`, { cuerpo: {} })
    expect(r.status).toBe(404)
    expect(await abonosDe(cobranza)).toHaveLength(0)
  })
})

describe('3 · la tabla está aislada', () => {
  it('el rol de la app no ve ningún abono sin fijar la organización', async () => {
    const hay = await poolTest().query('select count(*)::int as n from cobranza_abonos')
    expect(hay.rows[0].n).toBeGreaterThan(0)
    const sinTenant = await poolApp().query('select count(*)::int as n from cobranza_abonos')
    expect(sinTenant.rows[0].n).toBe(0)
  })

  it('en TODA cobranza, lo pagado es la suma de sus abonos', async () => {
    const r = await poolTest().query(`
      select count(*)::int as n from cobranzas c
       where c.monto_pagado <> coalesce((select sum(x.monto) from cobranza_abonos x where x.cobranza_id = c.id), 0)`)
    expect(r.rows[0].n).toBe(0)
  })
})

describe('4 · el tablero y el estado de cuenta por periodo', () => {
  let cliente: string
  beforeAll(async () => {
    // Un cliente propio para que las cifras no se mezclen con lo de arriba.
    cliente = (
      await poolTest().query(
        `insert into clientes (nombre, tenant_id) values ('Cliente del estado de cuenta', $1) returning id`,
        [org.id],
      )
    ).rows[0].id
    const f1 = await factura({ id: org.id, clienteId: cliente }, 11600, '2026-08-15', '2026-09-14')
    await factura({ id: org.id, clienteId: cliente }, 23200, '2026-09-10', '2026-10-10')
    await c.pedir(`/api/cobranzas/${f1.cobranza}/pagar/`, { cuerpo: { monto: 5000, fecha: '2026-09-20' } })
    // Lo de la OTRA organización, en las mismas fechas, no puede aparecer.
    await factura(otra, 99999, '2026-09-11', '2026-09-12')
  })

  const resumen = (q: string) => c.pedir(`/api/finanzas/resumen/?${q}`)

  it('rango de septiembre del cliente: facturado, cobrado, saldos y vencido', async () => {
    const r = await resumen(`periodo=rango&desde=2026-09-01&hasta=2026-09-30&cliente=${cliente}`)
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.periodo).toMatchObject({ desde: '2026-09-01', hasta: '2026-09-30' })
    expect(r.datos.resumen).toMatchObject({
      facturado: { monto: 23200, facturas: 1 },
      cobrado: 5000,
      saldoInicial: 11600,
      saldoFinal: 29800,
      vencido: { monto: 6600, facturas: 1 },
      renta: null,
    })
  })

  it('los movimientos del estado de cuenta, con su saldo corrido', async () => {
    const r = await resumen(`periodo=rango&desde=2026-09-01&hasta=2026-09-30&cliente=${cliente}`)
    expect(r.datos.movimientos.map((m: any) => [m.fecha, m.tipo, m.cargo, m.abono, m.saldo])).toEqual([
      ['2026-09-10', 'factura', 23200, 0, 34800],
      ['2026-09-20', 'abono', 0, 5000, 29800],
    ])
  })

  it('la vista de la empresa no trae nada de la otra organización', async () => {
    const r = await resumen('periodo=rango&desde=2026-09-11&hasta=2026-09-11')
    expect(r.status).toBe(200)
    expect(r.datos.resumen.facturado).toEqual({ monto: 0, facturas: 0 })
    expect(r.datos.resumen.renta).not.toBeNull()
  })

  it('los periodos con nombre responden, y uno desconocido es un 400', async () => {
    for (const p of ['mes', 'mes-anterior', 'trimestre', 'trimestre-anterior', 'anio']) {
      const r = await resumen(`periodo=${p}`)
      expect(r.status, p).toBe(200)
      expect(r.datos.periodo.etiqueta).toBeTruthy()
    }
    expect((await resumen('periodo=siglo')).status).toBe(400)
    expect((await resumen('periodo=rango&desde=ayer&hasta=hoy')).status).toBe(400)
  })

  it('el cliente de otra organización es un 404, no un estado de cuenta vacío', async () => {
    const r = await resumen(`periodo=mes&cliente=${otra.clienteId}`)
    expect(r.status).toBe(404)
  })

  it('sin sesión no hay resumen', async () => {
    const r = await new Cliente().pedir('/api/finanzas/resumen/?periodo=mes')
    expect(r.status).toBe(401)
  })
})

describe('5 · el rescate de lo cobrado antes de la migración', () => {
  it('fecha lo ya pagado con el último pago de la bitácora, y cuadra el invariante', async () => {
    const { cobranza, folio } = await factura(org, 2000, '2026-08-01', '2026-09-01')
    // Como estaba antes del 06/10: un acumulado sin renglones, y la bitácora.
    // La cobranza nació con la factura (01/08): el rescate solo acepta pagos de
    // la bitácora POSTERIORES a la cobranza, para no tomar el de una factura
    // anterior que hubiera reusado el folio.
    await poolTest().query(
      `update cobranzas set monto_pagado = 2000, creado_en = '2026-08-01 10:00-06' where id = $1`,
      [cobranza],
    )
    await poolTest().query(
      `insert into acciones (accion, entidad, usuario_nombre, "timestamp", tenant_id)
       values ('Registró abono $500', $1, 'x', '2026-08-10 12:00-06', $2),
              ('Registró pago $1,500 (liquidado)', $1, 'x', '2026-08-20 12:00-06', $2)`,
      [folio, org.id],
    )
    // Y uno sin rastro en la bitácora.
    const sinRastro = await factura(org, 300, '2026-08-01', '2026-09-01')
    await poolTest().query('update cobranzas set monto_pagado = 300 where id = $1', [sinRastro.cobranza])

    const sql = readFileSync(join(process.cwd(), '../../db/migrations/20261008_cobranza_abonos.sql'), 'utf8')
    await poolTest().query(sql)

    expect(await abonosDe(cobranza)).toEqual([{ monto: 2000, fecha: '2026-08-20', origen: 'historico', usuario_id: null }])
    expect(await abonosDe(sinRastro.cobranza)).toEqual([{ monto: 300, fecha: null, origen: 'historico', usuario_id: null }])

    // Idempotente: correrla otra vez no duplica nada.
    await poolTest().query(sql)
    expect(await abonosDe(cobranza)).toHaveLength(1)
  })
})
