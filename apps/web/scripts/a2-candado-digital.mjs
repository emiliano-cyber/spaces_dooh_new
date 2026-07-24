// ============================================================================
//  a2-candado-digital.mjs — Gate de la Fase 3 (A-2): verdad del candado de
//  facturación por SEGMENTO. Prueba el gate AUTORITATIVO del servidor
//  (facturar) + el estado real de los flags:
//    (a) DOOH sin proof-of-play (reporte digital OFF)       → candado OFF, factura bloqueada
//    (b) DOOH con reproducciones (reporte digital ON)         → candado ON, factura permitida
//    (c) HÍBRIDA con OT física cerrada pero sin digital       → candado OFF, factura bloqueada
//        (cerrar la OT de lona enciende fotos FÍSICAS pero NO reporte DIGITAL)
//    (d) HÍBRIDA con ambos segmentos                          → candado ON, factura permitida
//
//  El proof-of-play digital se REPRESENTA por reporte_publicacion (que es lo que
//  enciende playlogs-repo con reproducciones reales); la evidencia física se
//  produce cerrando una OT MONTAJE_LONA real por el endpoint.
//  Uso: node scripts/a2-candado-digital.mjs   (dev server en :3000)
// ============================================================================
import pg from 'pg'

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:3000/spaces-dooh/api'
const DB = process.env.DATABASE_URL ?? 'postgresql://spaces:spaces@localhost:5433/spaces'
const EMAIL = 'jose@pixeled.com.mx'
const PW = 'spaces123'
const TENANT = 'd8e51e47-2205-48d0-b087-07ba2478bcf2'

// PNG 1×1 válido (data URL) para la evidencia de la OT (el endpoint valida imagen).
const FOTO_OK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

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
  await pool.query(`delete from cobranzas where factura_id in (select f.id from facturas f join campanas c on c.id=f.campana_id where c.nombre like 'TEST_A2%')`)
  await pool.query(`delete from facturas where campana_id in (select id from campanas where nombre like 'TEST_A2%')`)
  await pool.query(`delete from evidencias_ot where ot_id in (select id from ordenes_trabajo where campana_id in (select id from campanas where nombre like 'TEST_A2%'))`)
  await pool.query(`delete from ordenes_trabajo where campana_id in (select id from campanas where nombre like 'TEST_A2%')`)
  await pool.query(`delete from campanas where nombre like 'TEST_A2%'`)
  await pool.query(`delete from clientes where nombre like 'TEST_A2%'`)
}

let clienteId = null
async function crearCampana(sufijo, tipo, { oc, fotos, reporte }) {
  const r = await pool.query(
    `insert into campanas
       (nombre, cliente_id, fecha_inicio, fecha_fin, tipo_campana, estado_comercial,
        oc_recibida, fotos_comprobatorias, reporte_publicacion, presupuesto_neto, tenant_id)
     values ($1,$2,'2026-11-01','2026-11-30',$3::tipo_campana,'ACTIVA',$4,$5,$6,50000,$7) returning id`,
    [`TEST_A2_${sufijo}`, clienteId, tipo, oc, fotos, reporte, TENANT],
  )
  return r.rows[0].id
}
const flags = async (id) => (await pool.query(
  `select oc_recibida, fotos_comprobatorias, reporte_publicacion, tipo_campana from campanas where id=$1`, [id],
)).rows[0]
const nFacturas = async (id) => Number((await pool.query(`select count(*) n from facturas where campana_id=$1`, [id])).rows[0].n)

async function main() {
  console.log('A-2 CANDADO POR SEGMENTO — verdad de facturación digital/física\n')
  await limpiar()
  const ses = await login(); ok('login')
  const cli = await api('POST', '/clientes/', ses, {
    nombre: 'TEST_A2_Cliente', rfc: 'TST010101AAA', razonSocial: 'TEST A2 SA', usoCfdi: 'G03',
  })
  assert(cli.status === 201, 'crear cliente con RFC')
  clienteId = cli.data.id

  // ── (a) DOOH sin proof-of-play → OFF ───────────────────────────────────────
  {
    const id = await crearCampana('a_DOOH', 'DOOH', { oc: true, fotos: false, reporte: false })
    const f = await flags(id)
    const fac = await api('POST', `/campanas/${id}/facturar/`, ses, { plazoDias: 60 })
    console.log(`    (a) DOOH oc=${f.oc_recibida} reporteDigital=${f.reporte_publicacion} → facturar=${fac.status} "${fac.data?.error ?? ''}"`)
    assert(fac.status >= 400 && await nFacturas(id) === 0, '(a) DOOH sin reproducciones → factura BLOQUEADA')
    ok('(a) DOOH proof-of-play vacío → candado OFF (factura bloqueada)')
  }

  // ── (b) DOOH con reproducciones → ON ───────────────────────────────────────
  {
    const id = await crearCampana('b_DOOH', 'DOOH', { oc: true, fotos: false, reporte: false })
    // Reproducciones reales: playlogs-repo enciende la evidencia DIGITAL (reporte).
    await pool.query(`update campanas set reporte_publicacion=true where id=$1`, [id])
    const fac = await api('POST', `/campanas/${id}/facturar/`, ses, { plazoDias: 60 })
    console.log(`    (b) DOOH reporteDigital=true → facturar=${fac.status} folio=${fac.data?.folio ?? ''}`)
    assert(fac.status === 201 && await nFacturas(id) === 1, '(b) DOOH con reproducciones → factura PERMITIDA')
    ok('(b) DOOH con reproducciones → candado ON (factura emitida)')
  }

  // ── (c) HÍBRIDA con OT física cerrada pero SIN digital → OFF ────────────────
  {
    const id = await crearCampana('c_HIB', 'HIBRIDA', { oc: true, fotos: false, reporte: false })
    const sitio = (await pool.query(`select id from sitios where tipo_medio='ESPECTACULAR' limit 1`)).rows[0].id
    const otId = (await pool.query(
      `insert into ordenes_trabajo (tipo, descripcion, campana_id, sitio_id, estatus, tenant_id)
       values ('MONTAJE_LONA','TEST_A2 montaje lona',$1,$2,'ASIGNADA',$3) returning id`,
      [id, sitio, TENANT],
    )).rows[0].id
    // Cerrar la OT FÍSICA por el endpoint real (enciende fotos FÍSICAS).
    const cerr = await api('POST', `/ot/${otId}/cerrar/`, ses, { fotoUrl: FOTO_OK })
    assert(cerr.status === 200, `(c) cerrar OT MONTAJE_LONA (status ${cerr.status})`)
    const f = await flags(id)
    console.log(`    (c) HÍBRIDA tras cerrar OT lona → fotosFisica=${f.fotos_comprobatorias} reporteDigital=${f.reporte_publicacion}`)
    assert(f.fotos_comprobatorias === true, '(c) la OT de lona encendió la evidencia FÍSICA')
    assert(f.reporte_publicacion === false, '(c) la OT de lona NO tocó la evidencia DIGITAL (segmentos independientes)')
    const fac = await api('POST', `/campanas/${id}/facturar/`, ses, { plazoDias: 60 })
    console.log(`    (c) facturar=${fac.status} "${fac.data?.error ?? ''}"`)
    assert(fac.status >= 400 && await nFacturas(id) === 0, '(c) HÍBRIDA sin digital → factura BLOQUEADA')
    ok('(c) HÍBRIDA con OT física pero sin proof-of-play digital → candado OFF')
    // (d) sobre la misma híbrida: agregar la evidencia digital → ON
    await pool.query(`update campanas set reporte_publicacion=true where id=$1`, [id])
    const fac2 = await api('POST', `/campanas/${id}/facturar/`, ses, { plazoDias: 60 })
    console.log(`    (d) HÍBRIDA física+digital → facturar=${fac2.status} folio=${fac2.data?.folio ?? ''}`)
    assert(fac2.status === 201 && await nFacturas(id) === 1, '(d) HÍBRIDA con ambos → factura PERMITIDA')
    ok('(d) HÍBRIDA con evidencia física Y digital → candado ON (factura emitida)')
  }

  await limpiar()
  console.log(`\nA-2 CANDADO OK — ${verdes} aserciones en verde.`)
  await pool.end()
}

main().catch(async (e) => {
  console.error('\n' + (e?.message ?? e))
  try { await limpiar() } catch { /* */ }
  await pool.end()
  process.exit(1)
})
