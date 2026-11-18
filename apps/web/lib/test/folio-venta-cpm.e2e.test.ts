import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  CPS-CPM y FOLIO-VENTA (07/10) · pedido de ventas del 06/10:
//    «cps y cpm» · «asociar el id con el no. venta y si se alarga campaña
//    añadir un .1 para el número».
// ----------------------------------------------------------------------------
//  Va por HTTP contra Postgres porque lo que importa no se ve con mocks: que
//  el folio lo escribe la MISMA transacción que crea la campaña, que el tramo
//  .1/.2 lo pone el `update` que alarga la fecha (no una lectura previa que
//  dos extensiones a la vez leerían igual), y que un CPM llega a la base con
//  sus millares y su importe, y de ahí a la reserva de la campaña.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let c: Cliente

const enDias = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('folioventa')
  // La pantalla sembrada es digital: se le publica una tarifa CPM de 85.
  await poolTest().query(
    `insert into sitio_modalidades (sitio_id, unidad, tarifa_publicada, costo_compra, tenant_id)
     values ($1, 'cpm', 85, 0, $2)`,
    [org.sitioId, org.id],
  )
  await arrancarServidor()
  c = new Cliente()
  await c.entrar(org.usuarioEmail, PASSWORD_DEMO)
  const r = await c.pedir('/api/cambios/desbloquear/', { cuerpo: { password: PASSWORD_DEMO } })
  expect(r.status, JSON.stringify(r.datos)).toBe(200)
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

async function propuestaAprobada(nombre: string, item: Record<string, unknown>) {
  const prop = await c.pedir('/api/propuestas/', {
    cuerpo: { clienteId: org.clienteId, nombre, fechaInicio: enDias(7), fechaFin: enDias(36), items: [{ sitioId: org.sitioId, ...item }] },
  })
  expect(prop.status, JSON.stringify(prop.datos)).toBe(201)
  const ap = await c.pedir(`/api/propuestas/${prop.datos.id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'APROBADA' } })
  expect(ap.status, JSON.stringify(ap.datos)).toBe(200)
  const gen = await c.pedir(`/api/propuestas/${prop.datos.id}/generar-campana/`, { cuerpo: {} })
  expect(gen.status, JSON.stringify(gen.datos)).toBe(200)
  return { propuestaId: prop.datos.id as string, folioVenta: prop.datos.folio as string, campana: gen.datos }
}

const folioDe = async (campanaId: string) =>
  (await poolTest().query('select folio, to_char(fecha_fin, \'YYYY-MM-DD\') fin from campanas where id = $1', [campanaId])).rows[0]

describe('1 · la campaña lleva el folio de su venta', () => {
  it('nace con el folio de la propuesta', async () => {
    const { folioVenta, campana } = await propuestaAprobada('Venta con folio', { unidad: 'mensual', tarifaUnitaria: 45000 })
    expect(folioVenta).toMatch(/^PR-\d{4}-\d{4}$/)
    expect(campana.folio).toBe(folioVenta)
    expect((await folioDe(campana.id)).folio).toBe(folioVenta)
  })

  it('una campaña creada sin propuesta conserva su folio propio', async () => {
    // Control: el cambio es para lo que nace de una venta, no para todo.
    const r = await poolTest().query(`select count(*)::int n from campanas where propuesta_id is null and folio like 'PR-%'`)
    expect(r.rows[0].n).toBe(0)
  })
})

// EXT-CONTRATO (29/10) · extender exige el contrato firmado de la extensión.
// Un PDF mínimo de verdad (`%PDF-1.4`): el validador mira los bytes.
const PDF = 'data:application/pdf;base64,JVBERi0xLjQK'
const PDF2 = 'data:application/pdf;base64,JVBERi0xLjcK'

describe('2 · extender suma un tramo: .1, .2…', () => {
  it('cada extensión que alarga sube el tramo, y la misma fecha ya no es extensión', async () => {
    const { folioVenta, campana } = await propuestaAprobada('Venta que se alarga', { unidad: 'mensual', tarifaUnitaria: 45000 })
    const extender = (fechaFin: string) =>
      c.pedir(`/api/campanas/${campana.id}/extender/`, { cuerpo: { fechaFin, contratoUrl: PDF } })

    let r = await extender(enDias(66))
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.folio).toBe(`${folioVenta}.1`)

    r = await extender(enDias(96))
    expect(r.datos.folio).toBe(`${folioVenta}.2`)

    // Repetir la MISMA fecha no es una extensión: no inventa un .3 y, desde
    // EXT-CONTRATO, se rechaza (dejaría un contrato que no alarga nada).
    r = await extender(enDias(96))
    expect(r.status).toBe(400)

    expect(await folioDe(campana.id)).toEqual({ folio: `${folioVenta}.2`, fin: enDias(96) })
  })

  it('NEGATIVO · acortar sigue rechazándose y no toca el folio', async () => {
    const { folioVenta, campana } = await propuestaAprobada('Venta que no se acorta', { unidad: 'mensual', tarifaUnitaria: 45000 })
    const r = await c.pedir(`/api/campanas/${campana.id}/extender/`, { cuerpo: { fechaFin: enDias(10), contratoUrl: PDF } })
    expect(r.status).toBe(400)
    expect((await folioDe(campana.id)).folio).toBe(folioVenta)
  })

  it('dos extensiones a la vez no escriben el mismo tramo', async () => {
    const { folioVenta, campana } = await propuestaAprobada('Venta con carrera', { unidad: 'mensual', tarifaUnitaria: 45000 })
    const [a, b] = await Promise.all([
      c.pedir(`/api/campanas/${campana.id}/extender/`, { cuerpo: { fechaFin: enDias(60), contratoUrl: PDF } }),
      c.pedir(`/api/campanas/${campana.id}/extender/`, { cuerpo: { fechaFin: enDias(90), contratoUrl: PDF2 } }),
    ])
    // El orden de llegada lo decide la base. Desde EXT-CONTRATO la lectura
    // bloquea la fila (`for update`): si la de 90 días gana, la de 60 lee ya los
    // 90 y se rechaza como acortamiento (400); el 409 queda de última red. Si
    // gana la de 60, las dos escriben y la segunda ve el .1 de la primera.
    expect(b.status, JSON.stringify(b.datos)).toBe(200)
    expect([200, 400, 409]).toContain(a.status)
    const fin = await folioDe(campana.id)
    // Lo que no puede pasar: que la campaña acabe acortada, ni dos .1.
    expect(fin.fin).toBe(enDias(90))
    expect(fin.folio).toBe(a.status === 200 ? `${folioVenta}.2` : `${folioVenta}.1`)
    // Y una fila de contrato por cada extensión que de verdad se escribió.
    const n = (await poolTest().query('select count(*)::int n from campana_extensiones where campana_id = $1', [campana.id])).rows[0].n
    expect(n).toBe(a.status === 200 ? 2 : 1)
  })

  it('la bitácora dice qué folio quedó, hasta cuándo y que fue con contrato', async () => {
    const { folioVenta, campana } = await propuestaAprobada('Venta con bitácora', { unidad: 'mensual', tarifaUnitaria: 45000 })
    await c.pedir(`/api/campanas/${campana.id}/extender/`, { cuerpo: { fechaFin: enDias(70), contratoUrl: PDF } })
    const r = await poolTest().query(`select accion, entidad from acciones where accion like 'Extendió campaña%' order by "timestamp" desc limit 1`)
    expect(r.rows[0].accion).toBe(`Extendió campaña ${folioVenta}.1 hasta ${enDias(70)} con contrato`)
  })
})

describe('2b · EXT-CONTRATO (29/10) · no se extiende sin contrato nuevo', () => {
  it('NEGATIVO · sin contrato: 422 con el mensaje, y ni la fecha, ni el folio, ni las reservas cambian', async () => {
    const { folioVenta, campana } = await propuestaAprobada('Venta sin contrato', { unidad: 'mensual', tarifaUnitaria: 45000 })
    const antes = await folioDe(campana.id)
    const resAntes = (await poolTest().query('select to_char(fecha_fin, \'YYYY-MM-DD\') f from reservas where campana_id = $1', [campana.id])).rows
    const r = await c.pedir(`/api/campanas/${campana.id}/extender/`, { cuerpo: { fechaFin: enDias(80) } })
    expect(r.status, JSON.stringify(r.datos)).toBe(422)
    expect(r.datos.error).toBe('Para extender la campaña adjunta el contrato firmado de la extensión')
    expect(await folioDe(campana.id)).toEqual(antes)
    expect(antes.folio).toBe(folioVenta)
    const resDespues = (await poolTest().query('select to_char(fecha_fin, \'YYYY-MM-DD\') f from reservas where campana_id = $1', [campana.id])).rows
    expect(resDespues).toEqual(resAntes)
    const n = (await poolTest().query('select count(*)::int n from campana_extensiones where campana_id = $1', [campana.id])).rows[0].n
    expect(n).toBe(0)
  })

  it('con contrato: la fila queda con el folio del tramo, las fechas, el PDF y quién, y el contrato original sigue intacto', async () => {
    const { folioVenta, campana } = await propuestaAprobada('Venta con contrato', { unidad: 'mensual', tarifaUnitaria: 45000 })
    const original = 'data:application/pdf;base64,JVBERi0xLjUK'
    const ct = await c.pedir(`/api/campanas/${campana.id}/contrato/`, { cuerpo: { contratoUrl: original } })
    expect(ct.status, JSON.stringify(ct.datos)).toBe(200)
    const finAntes = (await folioDe(campana.id)).fin

    const r = await c.pedir(`/api/campanas/${campana.id}/extender/`, { cuerpo: { fechaFin: enDias(75), contratoUrl: PDF } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)

    const fila = (
      await poolTest().query(
        `select folio, to_char(fecha_fin_anterior,'YYYY-MM-DD') de, to_char(fecha_fin_nueva,'YYYY-MM-DD') a,
                contrato_url, usuario_nombre, tenant_id
           from campana_extensiones where campana_id = $1`,
        [campana.id],
      )
    ).rows
    expect(fila).toHaveLength(1)
    expect(fila[0]).toMatchObject({ folio: `${folioVenta}.1`, de: finAntes, a: enDias(75), contrato_url: PDF, tenant_id: org.id })
    expect(fila[0].usuario_nombre).toBeTruthy()
    // El contrato del cliente NO se sobrescribió: por eso existe la tabla.
    const cu = (await poolTest().query('select contrato_url from campanas where id = $1', [campana.id])).rows[0]
    expect(cu.contrato_url).toBe(original)

    // Y la ficha lo lee por GET.
    const g = await c.pedir(`/api/campanas/${campana.id}/extender/`, { metodo: 'GET' })
    expect(g.status, JSON.stringify(g.datos)).toBe(200)
    expect(g.datos).toHaveLength(1)
    expect(g.datos[0]).toMatchObject({ folio: `${folioVenta}.1`, fechaFinNueva: enDias(75), contratoUrl: PDF })
  })

  it('NEGATIVO · restrict: la campaña con extensiones no se puede borrar (los contratos no se pierden)', async () => {
    const { campana } = await propuestaAprobada('Venta que no se borra', { unidad: 'mensual', tarifaUnitaria: 45000 })
    const r = await c.pedir(`/api/campanas/${campana.id}/extender/`, { cuerpo: { fechaFin: enDias(77), contratoUrl: PDF } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    await expect(poolTest().query('delete from campanas where id = $1', [campana.id])).rejects.toMatchObject({ code: '23503' })
  })

  it('el rol de la aplicación puede leer e insertar, y NO actualizar ni borrar', async () => {
    // Mismo control que `contrato-firmado-editable.e2e` sobre su tabla gemela.
    const priv = async (p: string) =>
      (await poolTest().query(`select has_table_privilege('spaces_app', 'campana_extensiones', $1) as si`, [p])).rows[0].si
    expect(await priv('SELECT')).toBe(true)
    expect(await priv('INSERT')).toBe(true)
    expect(await priv('UPDATE')).toBe(false)
    expect(await priv('DELETE')).toBe(false)
    expect(await priv('TRUNCATE')).toBe(false)
  })
})

describe('3 · CPM de punta a punta', () => {
  it('2 500 millares a 85: la propuesta guarda 212 500 y la reserva hereda los millares', async () => {
    const { propuestaId, campana } = await propuestaAprobada('Venta por CPM', { unidad: 'cpm', tarifaUnitaria: 85, cantidad: 2500 })
    const it0 = (
      await poolTest().query(
        'select unidad, cantidad::float, tarifa_unitaria::float, precio::float from propuesta_items where propuesta_id = $1',
        [propuestaId],
      )
    ).rows[0]
    expect(it0).toEqual({ unidad: 'cpm', cantidad: 2500, tarifa_unitaria: 85, precio: 212500 })
    const res = (
      await poolTest().query('select unidad, cantidad::float from reservas where campana_id = $1', [campana.id])
    ).rows[0]
    expect(res).toEqual({ unidad: 'cpm', cantidad: 2500 })
  })

  it('NEGATIVO · CPM en una pantalla FIJA no se puede publicar como modalidad', async () => {
    const fija = await poolTest().query(
      `insert into sitios (nombre, clave_interna, codigo_proveedor, tipo_medio, estatus_comercial, tarifa_publicada, tenant_id, exhibicion)
       values ('Espectacular', 'FV-FIJA-01', 'FV-FIJA-P01', 'ESPECTACULAR', 'DISPONIBLE', 30000, $1, 'fijo') returning id`,
      [org.id],
    )
    const r = await c.pedir(`/api/sitios/${fija.rows[0].id}/modalidades/`, {
      metodo: 'PATCH',
      cuerpo: { guardar: [{ unidad: 'cpm', tarifaPublicada: 85 }] },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(400)
    expect(JSON.stringify(r.datos)).toMatch(/mensual/)
    const m = await poolTest().query('select count(*)::int n from sitio_modalidades where sitio_id = $1', [fija.rows[0].id])
    expect(m.rows[0].n).toBe(0)
  })
})
