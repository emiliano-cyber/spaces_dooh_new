// ============================================================================
//  smoke-e2e.mjs — Smoke test REPETIBLE de la cadena comercial completa:
//  cliente → propuesta → aprobación granular → campaña → ODC → candado → factura → cobranza.
//
//  Usa el BFF real (HTTP) + Postgres para sembrar flags y limpiar. Todo lo que
//  crea lleva prefijo TEST_ y se borra al final (y al inicio, para ser idempotente).
//  NO toca datos que no sean TEST_. Se puede correr N veces seguidas.
//
//  Uso:  node scripts/smoke-e2e.mjs
//  Requiere: dev server en :3000 y DATABASE_URL (default postgres del demo :5433).
// ============================================================================
import pg from 'pg'

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:3000/spaces-dooh/api'
const DB = process.env.DATABASE_URL ?? 'postgresql://spaces:spaces@localhost:5433/spaces'
const EMAIL = 'jose@pixeled.com.mx'
const PW = 'spaces123'
const COMISION = 15
const DIVISOR = 1 - COMISION / 100

const pool = new pg.Pool({ connectionString: DB })
let pasos = 0
function ok(msg) { pasos++; console.log(`  ✓ ${msg}`) }
function assert(cond, msg) { if (!cond) { throw new Error(`✗ FALLA: ${msg}`) } }

// ─── Limpieza de cualquier residuo TEST_ (orden inverso de dependencias) ─────
async function limpiar() {
  // facturas (RESTRICT) antes de campañas; cobranzas cae por cascade de factura
  await pool.query(`delete from cobranzas where factura_id in (select f.id from facturas f join campanas c on c.id=f.campana_id where c.nombre like 'TEST_%')`)
  await pool.query(`delete from facturas where campana_id in (select id from campanas where nombre like 'TEST_%')`)
  // restaurar sitios que el test haya dejado RESERVADO
  await pool.query(`update sitios set estatus_comercial='DISPONIBLE' where id in (select sitio_id from reservas r join campanas c on c.id=r.campana_id where c.nombre like 'TEST_%')`)
  await pool.query(`delete from campanas where nombre like 'TEST_%'`) // cascade: reservas, ordenes_compra
  await pool.query(`delete from propuestas where nombre like 'TEST_%'`) // cascade: propuesta_items
  await pool.query(`delete from clientes where nombre like 'TEST_%'`)
}

async function login() {
  const r = await fetch(`${BASE}/auth/login/`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PW }),
  })
  const sc = r.headers.getSetCookie?.() ?? []
  const c = sc.find((x) => x.startsWith('spaces_sesion='))
  if (!c) throw new Error('login falló')
  return c.split(';')[0]
}

async function api(method, path, cookie, body) {
  const r = await fetch(`${BASE}${path}`, {
    method, headers: { 'content-type': 'application/json', cookie },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  let data = null
  try { data = await r.json() } catch { /* sin cuerpo */ }
  return { status: r.status, data }
}

async function main() {
  console.log('SMOKE E2E — cadena comercial completa\n')
  await limpiar() // arranca limpio

  const cookie = await login(); ok('login')

  // sitios disponibles para la prueba
  const sitios = (await pool.query(`select id from sitios where estatus_comercial='DISPONIBLE' limit 3`)).rows.map((r) => r.id)
  assert(sitios.length >= 3, 'se necesitan 3 sitios disponibles')

  // 1) Cliente con datos fiscales
  const cli = await api('POST', '/clientes/', cookie, {
    nombre: 'TEST_Cliente', rfc: 'TST010101AAA', razonSocial: 'TEST SA de CV', usoCfdi: 'G03',
  })
  assert(cli.status === 201 && cli.data?.id, '1. crear cliente')
  ok('1. cliente TEST_ con RFC')

  // 2) Propuesta con 3 sitios (precios bruto de lista)
  const precios = { [sitios[0]]: 50000, [sitios[1]]: 30000, [sitios[2]]: 20000 }
  const prop = await api('POST', '/propuestas/', cookie, {
    clienteId: cli.data.id, nombre: 'TEST_Propuesta', comisionPct: COMISION,
    fechaInicio: '2026-10-01', fechaFin: '2026-10-31',
    items: sitios.map((s) => ({ sitioId: s, precio: precios[s] })),
  })
  assert(prop.status === 201 && prop.data?.items?.length === 3, '2. crear propuesta con 3 items')
  ok('2. propuesta con 3 sitios')

  // 3) Aprobación granular: aprobar 2, dejar 1 sin aprobar
  const items = prop.data.items
  for (const it of items.slice(0, 2)) {
    const a = await api('PATCH', `/propuestas/items/${it.id}/`, cookie, { aprobado: true })
    assert(a.status === 200, '3. aprobar item')
  }
  ok('3. aprobados 2 de 3 sitios')
  // marcar la propuesta como APROBADA (después de aprobar items: luego queda inmutable)
  const apr = await api('PATCH', `/propuestas/${prop.data.id}/`, cookie, { estatus: 'APROBADA' })
  assert(apr.status === 200 && apr.data?.estatus === 'APROBADA', '3b. propuesta APROBADA')
  // congelado: ya no se editan items
  const frozen = await api('PATCH', `/propuestas/items/${items[2].id}/`, cookie, { aprobado: true })
  assert(frozen.status === 409, '3c. propuesta aprobada es inmutable (409)')
  ok('3c. congelado verificado (editar item aprobada → 409)')

  // 4) Generar campaña desde la propuesta
  const gen = await api('POST', `/propuestas/${prop.data.id}/generar-campana/`, cookie)
  assert(gen.status === 201, '4. generar campaña')
  const camp = gen.data
  assert(camp.estadoComercial === 'CONFIRMADA', '4. campaña CONFIRMADA')
  assert(camp.propuestaId === prop.data.id, '4. campaña ligada a la propuesta')
  // renombrar la campaña del test a TEST_ para que la limpieza la tome
  await pool.query(`update campanas set nombre='TEST_Campana' where id=$1`, [camp.id])
  // solo los 2 aprobados entraron, con precio neto (item.precio × divisor)
  const res = (await pool.query(`select sitio_id, precio from reservas where campana_id=$1 order by precio desc`, [camp.id])).rows
  assert(res.length === 2, `4. solo 2 reservas (aprobados), hay ${res.length}`)
  assert(Number(res[0].precio) === Math.round(50000 * DIVISOR), `4. precio neto sitio1 (esperado ${Math.round(50000*DIVISOR)}, real ${res[0].precio})`)
  assert(Number(res[1].precio) === Math.round(30000 * DIVISOR), `4. precio neto sitio2`)
  ok(`4. campaña ligada · solo 2 aprobados · precio neto ×${DIVISOR} (sin doble comisión)`)

  // idempotencia
  const gen2 = await api('POST', `/propuestas/${prop.data.id}/generar-campana/`, cookie)
  assert(gen2.status === 201 && gen2.data.id === camp.id, '4b. idempotente (misma campaña)')
  ok('4b. idempotente (no duplica)')

  // 5) ODC → abre oc_recibida
  const odc = await api('POST', '/ordenes-compra/', cookie, { campanaId: camp.id })
  assert(odc.status === 201, '5. registrar ODC')
  const ocFlag = (await pool.query(`select oc_recibida from campanas where id=$1`, [camp.id])).rows[0].oc_recibida
  assert(ocFlag === true, '5. ODC marca oc_recibida')
  ok('5. ODC registrada (oc_recibida=true)')

  // 6) Candado exige los 3: con solo OC, facturar debe FALLAR
  const facFail = await api('POST', `/campanas/${camp.id}/facturar/`, cookie, { plazoDias: 60 })
  assert(facFail.status >= 400, '6. facturar sin testigos+reporte → falla (candado incompleto)')
  ok('6a. candado bloquea factura con solo OC (faltan testigos+reporte)')
  // simular testigos (foto OT) + reporte de publicación
  await pool.query(`update campanas set fotos_comprobatorias=true, reporte_publicacion=true where id=$1`, [camp.id])
  ok('6b. marcados testigos + reporte (candado completo)')

  // 7) Factura fiscal (folio + IVA)
  const fac = await api('POST', `/campanas/${camp.id}/facturar/`, cookie, { plazoDias: 60 })
  assert(fac.status === 201, '7. generar factura')
  assert(fac.data.folioFiscal, '7. factura con folio fiscal')
  assert(Number(fac.data.igv) > 0 && Number(fac.data.monto) > Number(fac.data.subtotal), '7. IVA aplicado (monto>subtotal)')
  ok(`7. factura fiscal (folio ${fac.data.folio}, folioFiscal ✓, IVA ${fac.data.igv})`)

  // 8) Cobranza creada para la factura
  const cob = (await pool.query(`select estatus, plazo_dias from cobranzas where factura_id=$1`, [fac.data.id])).rows[0]
  assert(cob, '8. cobranza creada para la factura')
  assert(Number(cob.plazo_dias) === 60, '8. cobranza con plazo 60')
  ok(`8. cobranza en bucket (estatus ${cob.estatus}, plazo ${cob.plazo_dias}d)`)

  await limpiar() // limpia todo TEST_
  // verificar que no quedó basura
  const resto = (await pool.query(`select
    (select count(*) from clientes where nombre like 'TEST_%') c,
    (select count(*) from propuestas where nombre like 'TEST_%') p,
    (select count(*) from campanas where nombre like 'TEST_%') ca`)).rows[0]
  assert(Number(resto.c) + Number(resto.p) + Number(resto.ca) === 0, 'limpieza: 0 residuos TEST_')
  ok('limpieza: 0 residuos TEST_')

  console.log(`\nSMOKE E2E OK — ${pasos} aserciones en verde. Cadena completa conectada.`)
  await pool.end()
}

main().catch(async (e) => {
  console.error('\n' + e.message)
  try { await limpiar() } catch { /* */ }
  await pool.end()
  process.exit(1)
})
