// ============================================================================
//  a1-concurrencia.mjs — Gate de la Fase 1 (A-1): prueba de condiciones de
//  carrera de dinero. Dispara 2 peticiones IDÉNTICAS en paralelo (Promise.all)
//  contra el BFF real en cada punto crítico y verifica el resultado a nivel BD:
//    (a) doble facturación de la misma campaña   → 1×201 + 1×409, 1 factura
//    (b) doble campaña de la misma propuesta      → sin 500, 1 sola campaña
//        (endpoint idempotente: ambas devuelven la MISMA campaña)
//    (c) doble reserva del mismo sitio/fechas     → 1×201 + 1×409, 1 reserva
//
//  Todo lo que crea lleva prefijo TEST_ y se limpia al inicio y al final.
//  Uso: node scripts/a1-concurrencia.mjs   (requiere dev server en :3000)
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

async function limpiar() {
  await pool.query(`delete from cobranzas where factura_id in (select f.id from facturas f join campanas c on c.id=f.campana_id where c.nombre like 'TEST_%')`)
  await pool.query(`delete from facturas where campana_id in (select id from campanas where nombre like 'TEST_%')`)
  await pool.query(`update sitios set estatus_comercial='DISPONIBLE' where id in (select sitio_id from reservas r join campanas c on c.id=r.campana_id where c.nombre like 'TEST_%')`)
  await pool.query(`delete from campanas where nombre like 'TEST_%'`)
  await pool.query(`delete from propuestas where nombre like 'TEST_%'`)
  await pool.query(`delete from clientes where nombre like 'TEST_%'`)
}

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

async function api(method, path, sesion, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', cookie: sesion.cookie, 'x-csrf-token': sesion.csrf },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  let data = null
  try { data = await r.json() } catch { /* sin cuerpo */ }
  return { status: r.status, data }
}

// Crea cliente + propuesta APROBADA con 1 sitio aprobado. Devuelve { propId }.
async function propuestaAprobada(ses, sitioId, precio = 40000) {
  const cli = await api('POST', '/clientes/', ses, {
    nombre: 'TEST_Cliente', rfc: 'TST010101AAA', razonSocial: 'TEST SA de CV', usoCfdi: 'G03',
  })
  assert(cli.status === 201, 'crear cliente')
  const prop = await api('POST', '/propuestas/', ses, {
    clienteId: cli.data.id, nombre: 'TEST_Propuesta', comisionPct: COMISION,
    fechaInicio: '2026-11-01', fechaFin: '2026-11-30',
    items: [{ sitioId, precio }],
  })
  assert(prop.status === 201 && prop.data?.items?.length === 1, 'crear propuesta 1 item')
  const it = prop.data.items[0]
  const a = await api('PATCH', `/propuestas/items/${it.id}/`, ses, { aprobado: true })
  assert(a.status === 200, 'aprobar item')
  const apr = await api('PATCH', `/propuestas/${prop.data.id}/`, ses, { estatus: 'APROBADA' })
  assert(apr.status === 200, 'propuesta APROBADA')
  return { propId: prop.data.id }
}

const clasificar = (rs) => {
  const exitos = rs.filter((r) => r.status >= 200 && r.status < 300)
  const rechazos = rs.filter((r) => r.status >= 400 && r.status < 500)
  const cincos = rs.filter((r) => r.status >= 500)
  return { exitos, rechazos, cincos }
}

async function main() {
  console.log('A-1 CONCURRENCIA — carreras de dinero\n')
  await limpiar()
  const ses = await login(); ok('login')

  const disp = (await pool.query(
    `select s.id, s.tipo_medio,
            (select count(*) from reservas r where r.sitio_id=s.id and r.estatus<>'CANCELADA') activas
       from sitios s where s.estatus_comercial='DISPONIBLE' order by s.id`,
  )).rows
  assert(disp.length >= 3, 'se necesitan ≥3 sitios disponibles')
  const sitioA = disp[0].id            // caso (a)
  const sitioB = disp[1].id            // caso (b)
  // (c) necesita un sitio ESTÁTICO SIN reservas activas previas: así r1 siempre
  // puede reservar y la única colisión posible es entre las 2 peticiones del test.
  const sitioC = disp.find(
    (s) => s.tipo_medio !== 'PANTALLA_DIGITAL' && Number(s.activas) === 0 && s.id !== sitioA && s.id !== sitioB,
  )?.id
  assert(sitioC, 'se necesita un sitio estático limpio (sin reservas activas) para (c)')

  // ─── (a) DOBLE FACTURACIÓN DE LA MISMA CAMPAÑA ─────────────────────────────
  {
    const { propId } = await propuestaAprobada(ses, sitioA)
    const gen = await api('POST', `/propuestas/${propId}/generar-campana/`, ses)
    assert(gen.status === 201, '(a) generar campaña')
    const campId = gen.data.id
    await pool.query(`update campanas set nombre='TEST_Campana', fotos_comprobatorias=true, reporte_publicacion=true where id=$1`, [campId])
    const odc = await api('POST', '/ordenes-compra/', ses, { campanaId: campId })
    assert(odc.status === 201, '(a) ODC → oc_recibida')

    const [r1, r2] = await Promise.all([
      api('POST', `/campanas/${campId}/facturar/`, ses, { plazoDias: 60 }),
      api('POST', `/campanas/${campId}/facturar/`, ses, { plazoDias: 60 }),
    ])
    const { exitos, rechazos, cincos } = clasificar([r1, r2])
    const nFac = Number((await pool.query(`select count(*) n from facturas where campana_id=$1`, [campId])).rows[0].n)
    console.log(`    (a) status=[${r1.status},${r2.status}]  facturas_en_bd=${nFac}  rechazo="${(rechazos[0]?.data?.error) ?? ''}"`)
    assert(cincos.length === 0, '(a) ningún 500')
    assert(exitos.length === 1, '(a) exactamente 1 éxito')
    assert(rechazos.length === 1 && rechazos[0].status === 409, '(a) exactamente 1 rechazo 409')
    assert(nFac === 1, '(a) exactamente 1 factura en BD')
    ok('(a) doble facturación: 1×201 + 1×409, 1 sola factura')
  }
  await limpiar()

  // ─── (b) DOBLE CAMPAÑA DE LA MISMA PROPUESTA (endpoint idempotente) ─────────
  {
    const { propId } = await propuestaAprobada(ses, sitioB)
    const [r1, r2] = await Promise.all([
      api('POST', `/propuestas/${propId}/generar-campana/`, ses),
      api('POST', `/propuestas/${propId}/generar-campana/`, ses),
    ])
    const { cincos } = clasificar([r1, r2])
    const nCamp = Number((await pool.query(`select count(*) n from campanas where propuesta_id=$1`, [propId])).rows[0].n)
    console.log(`    (b) status=[${r1.status},${r2.status}]  ids=[${r1.data?.id?.slice(0,8)},${r2.data?.id?.slice(0,8)}]  campanas_en_bd=${nCamp}`)
    assert(cincos.length === 0, '(b) ningún 500')
    assert(nCamp === 1, '(b) exactamente 1 campaña en BD (sin duplicado)')
    assert(r1.data?.id && r2.data?.id && r1.data.id === r2.data.id, '(b) ambas respuestas → misma campaña (idempotente)')
    ok('(b) doble generación: sin 500, 1 sola campaña, respuestas idénticas')
  }
  await limpiar()

  // ─── (c) DOBLE RESERVA DEL MISMO SITIO/FECHAS (sitio estático) ─────────────
  {
    const cuerpo = {
      sitioIds: [sitioC], fechaInicio: '2026-12-01', fechaFin: '2026-12-31',
      clienteNombre: 'TEST_Cliente', nombreCampana: 'TEST_Campana',
    }
    const [r1, r2] = await Promise.all([
      api('POST', '/reservar/', ses, cuerpo),
      api('POST', '/reservar/', ses, cuerpo),
    ])
    const { exitos, rechazos, cincos } = clasificar([r1, r2])
    // Aísla el efecto del test: solo reservas creadas por campañas TEST_ en el
    // sitio (ignora datos reales pre-existentes de ese sitio, si los hubiera).
    const nRes = Number((await pool.query(
      `select count(*) n from reservas r join campanas c on c.id=r.campana_id
        where r.sitio_id=$1 and c.nombre like 'TEST_%' and r.estatus<>'CANCELADA'`, [sitioC],
    )).rows[0].n)
    console.log(`    (c) status=[${r1.status},${r2.status}]  reservas_TEST=${nRes}  rechazo="${(rechazos[0]?.data?.error) ?? ''}"`)
    assert(cincos.length === 0, '(c) ningún 500')
    assert(exitos.length === 1, '(c) exactamente 1 éxito')
    assert(rechazos.length === 1 && rechazos[0].status === 409, '(c) exactamente 1 rechazo 409')
    assert(nRes === 1, '(c) exactamente 1 reserva TEST_ creada (la 2ª hizo rollback)')
    ok('(c) doble reserva: 1×201 + 1×409, 1 sola reserva')
  }
  await limpiar()

  const resto = (await pool.query(`select
    (select count(*) from clientes where nombre like 'TEST_%') c,
    (select count(*) from propuestas where nombre like 'TEST_%') p,
    (select count(*) from campanas where nombre like 'TEST_%') ca`)).rows[0]
  assert(Number(resto.c) + Number(resto.p) + Number(resto.ca) === 0, 'limpieza: 0 residuos TEST_')
  ok('limpieza: 0 residuos TEST_')

  console.log(`\nA-1 CONCURRENCIA OK — ${verdes} aserciones en verde.`)
  await pool.end()
}

main().catch(async (e) => {
  console.error('\n' + (e?.message ?? e))
  try { await limpiar() } catch { /* */ }
  await pool.end()
  process.exit(1)
})
