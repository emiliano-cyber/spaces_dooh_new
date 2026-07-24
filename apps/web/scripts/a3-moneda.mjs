// ============================================================================
//  a3-moneda.mjs — Gate de la Fase 4 (A-3): la moneda se propaga desde el tenant
//  (snapshot) a campaña → reserva → factura. El tenant es MXN, así que los 3
//  registros deben quedar en 'MXN' (nunca el literal 'PEN').
//  Uso: node scripts/a3-moneda.mjs   (dev server en :3000)
// ============================================================================
import pg from 'pg'

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:3000/spaces-dooh/api'
const DB = process.env.DATABASE_URL ?? 'postgresql://spaces:spaces@localhost:5433/spaces'
const EMAIL = 'jose@pixeled.com.mx'
const PW = 'spaces123'
const COMISION = 15

const pool = new pg.Pool({ connectionString: DB })
let verdes = 0
const ok = (m) => { verdes++; console.log(`  ✓ ${m}`) }
const assert = (c, m) => { if (!c) throw new Error(`✗ FALLA: ${m}`) }

async function login() {
  const r = await fetch(`${BASE}/auth/login/`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PW }),
  })
  const sc = r.headers.getSetCookie?.() ?? []
  const ses = sc.find((x) => x.startsWith('spaces_sesion='))
  const csrfSet = sc.find((x) => x.startsWith('spaces_csrf='))
  if (!ses) throw new Error('login falló')
  const csrf = csrfSet ? csrfSet.split(';')[0].split('=')[1] : ''
  const cookie = [ses.split(';')[0], csrfSet ? csrfSet.split(';')[0] : ''].filter(Boolean).join('; ')
  return { cookie, csrf }
}
async function api(method, path, ses, body) {
  const r = await fetch(`${BASE}${path}`, {
    method, headers: { 'content-type': 'application/json', cookie: ses.cookie, 'x-csrf-token': ses.csrf },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  let data = null
  try { data = await r.json() } catch { /* */ }
  return { status: r.status, data }
}
async function limpiar() {
  await pool.query(`delete from cobranzas where factura_id in (select f.id from facturas f join campanas c on c.id=f.campana_id where c.nombre like 'TEST_A3%')`)
  await pool.query(`delete from facturas where campana_id in (select id from campanas where nombre like 'TEST_A3%')`)
  await pool.query(`update sitios set estatus_comercial='DISPONIBLE' where id in (select sitio_id from reservas r join campanas c on c.id=r.campana_id where c.nombre like 'TEST_A3%')`)
  await pool.query(`delete from campanas where nombre like 'TEST_A3%'`)
  await pool.query(`delete from propuestas where nombre like 'TEST_A3%'`)
  await pool.query(`delete from clientes where nombre like 'TEST_A3%'`)
}

async function main() {
  console.log('A-3 MONEDA DEL TENANT — propagación campaña→reserva→factura\n')
  await limpiar()
  const ses = await login(); ok('login')

  const tenantMoneda = (await pool.query(`select moneda from tenants where id='d8e51e47-2205-48d0-b087-07ba2478bcf2'`)).rows[0].moneda
  console.log(`    tenant.moneda = ${tenantMoneda}`)
  assert(tenantMoneda === 'MXN', 'tenant es MXN')

  const sitio = (await pool.query(`select id from sitios where estatus_comercial='DISPONIBLE' order by id limit 1`)).rows[0].id

  // Cliente con datos fiscales → propuesta aprobada → campaña (hereda moneda del tenant)
  const cli = await api('POST', '/clientes/', ses, { nombre: 'TEST_A3_Cliente', rfc: 'TST010101AAA', razonSocial: 'TEST A3 SA', usoCfdi: 'G03' })
  assert(cli.status === 201, 'cliente con RFC')
  const prop = await api('POST', '/propuestas/', ses, {
    clienteId: cli.data.id, nombre: 'TEST_A3_Propuesta', comisionPct: COMISION,
    fechaInicio: '2026-11-01', fechaFin: '2026-11-30', items: [{ sitioId: sitio, precio: 40000 }],
  })
  assert(prop.status === 201, 'propuesta')
  await api('PATCH', `/propuestas/items/${prop.data.items[0].id}/`, ses, { aprobado: true })
  await api('PATCH', `/propuestas/${prop.data.id}/`, ses, { estatus: 'APROBADA' })
  const gen = await api('POST', `/propuestas/${prop.data.id}/generar-campana/`, ses)
  assert(gen.status === 201, 'generar campaña')
  const campId = gen.data.id
  await pool.query(`update campanas set nombre='TEST_A3_Campana' where id=$1`, [campId])

  // 1) CAMPAÑA: moneda heredada del tenant
  const campMon = (await pool.query(`select moneda from campanas where id=$1`, [campId])).rows[0].moneda
  console.log(`    campaña.moneda = ${campMon}`)
  assert(campMon === 'MXN', '1. campaña en MXN (no PEN)')
  ok('1. campaña hereda moneda del tenant (MXN)')

  // 2) RESERVA: no tiene columna moneda; hereda de la campaña. Se verifica que la
  //    reserva pertenece a la campaña MXN.
  const res = (await pool.query(
    `select r.id, c.moneda from reservas r join campanas c on c.id=r.campana_id where r.campana_id=$1 limit 1`, [campId],
  )).rows[0]
  console.log(`    reserva → campaña.moneda = ${res?.moneda} (la reserva no almacena moneda; la hereda)`)
  assert(res && res.moneda === 'MXN', '2. reserva bajo campaña MXN')
  ok('2. reserva hereda la moneda de su campaña (MXN)')

  // 3) FACTURA: moneda tomada de la campaña (coalesce), nunca literal PEN
  await pool.query(`update campanas set oc_recibida=true, fotos_comprobatorias=true, reporte_publicacion=true, presupuesto_neto=40000 where id=$1`, [campId])
  const fac = await api('POST', `/campanas/${campId}/facturar/`, ses, { plazoDias: 60 })
  assert(fac.status === 201, '3. facturar')
  const facMon = (await pool.query(`select moneda from facturas where campana_id=$1`, [campId])).rows[0].moneda
  console.log(`    factura.moneda = ${facMon}`)
  assert(facMon === 'MXN', '3. factura en MXN (no PEN)')
  ok('3. factura toma la moneda de la campaña (MXN)')

  await limpiar()
  console.log(`\nA-3 MONEDA OK — ${verdes} aserciones en verde.`)
  await pool.end()
}

main().catch(async (e) => {
  console.error('\n' + (e?.message ?? e))
  try { await limpiar() } catch { /* */ }
  await pool.end()
  process.exit(1)
})
