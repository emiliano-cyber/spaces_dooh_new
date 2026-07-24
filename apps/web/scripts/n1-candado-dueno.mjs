// ============================================================================
//  n1-candado-dueno.mjs — Gate de N-1: el candado de datos bancarios del
//  arrendador ahora MUERDE incluso al DUEÑO (modo estricto `sinExenciones`).
//  También verifica que el modo estricto NO se fugó a otros flujos sensibles
//  (el Dueño sigue exento en un DELETE de arrendador, que es no-estricto).
//  Uso: node scripts/n1-candado-dueno.mjs   (dev server en :3000)
// ============================================================================
import pg from 'pg'

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:3000/spaces-dooh/api'
const DB = process.env.DATABASE_URL ?? 'postgresql://spaces:spaces@localhost:5433/spaces'
const DUENO_EMAIL = 'jose@pixeled.com.mx'
const DUENO_PW = 'spaces123'
const CAMBIOS_PW = 'CandadoN1.2026'
const TENANT = 'd8e51e47-2205-48d0-b087-07ba2478bcf2'

const pool = new pg.Pool({ connectionString: DB })
let verdes = 0
const ok = (m) => { verdes++; console.log(`  ✓ ${m}`) }
const assert = (c, m) => { if (!c) throw new Error(`✗ FALLA: ${m}`) }

async function login() {
  const r = await fetch(`${BASE}/auth/login/`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: DUENO_EMAIL, password: DUENO_PW }),
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

let hashOriginal = null
async function limpiar() {
  await pool.query(`update tenants set cambios_password_hash=$2 where id=$1`, [TENANT, hashOriginal])
  await pool.query(`delete from arrendadores where nombre like 'TEST_N1%'`)
}

async function main() {
  console.log('N-1 CANDADO BANCARIO SIN EXENCIÓN DE DUEÑO\n')
  hashOriginal = (await pool.query(`select cambios_password_hash h from tenants where id=$1`, [TENANT])).rows[0]?.h ?? null
  await limpiar()
  const dueno = await login(); ok('login Dueño')

  const arrId = (await pool.query(
    `insert into arrendadores (nombre, cuenta_bancaria, forma_pago, tenant_id) values ('TEST_N1_Arrendador','CTA-VIEJA-0001','TRANSFERENCIA',$1) returning id`,
    [TENANT],
  )).rows[0].id
  const arr2 = (await pool.query(
    `insert into arrendadores (nombre, tenant_id) values ('TEST_N1_ParaBorrar',$1) returning id`, [TENANT],
  )).rows[0].id

  // Activa el control de cambios y asegura que el Dueño NO esté desbloqueado
  const setpw = await api('PUT', '/cambios/', dueno, { password: CAMBIOS_PW })
  assert(setpw.status === 200 && setpw.data?.activo === true, 'activar control de cambios')
  await api('DELETE', '/cambios/desbloquear/', dueno) // re-bloquea la sesión del Dueño
  ok('setup: control ON, sesión del Dueño bloqueada')

  // (a) Campo NO sensible como Dueño sin reconfirmación → 200
  const a = await api('PATCH', `/arrendadores/${arrId}/`, dueno, { telefono: '5551234567' })
  console.log(`    (a) Dueño PATCH {telefono} → status=${a.status}`)
  assert(a.status === 200, '(a) no sensible pasa sin reconfirmación')
  ok('(a) Dueño edita campo NO sensible sin reconfirmación → 200')

  // (b) cuentaBancaria como Dueño SIN reconfirmación → RECHAZADO (N-1)
  const b = await api('PATCH', `/arrendadores/${arrId}/`, dueno, { cuentaBancaria: 'CTA-NUEVA-9999' })
  const bancoB = (await pool.query(`select cuenta_bancaria c from arrendadores where id=$1`, [arrId])).rows[0].c
  console.log(`    (b) Dueño PATCH {cuentaBancaria} sin reconfirmar → status=${b.status} requiereDesbloqueo=${b.data?.requiereDesbloqueo} · cuenta="${bancoB}"`)
  assert(b.status === 403 && b.data?.requiereDesbloqueo === true, '(b) el Dueño AHORA es desafiado (403)')
  assert(bancoB === 'CTA-VIEJA-0001', '(b) la cuenta NO cambió')
  ok('(b) Dueño cambia cuenta bancaria SIN reconfirmar → RECHAZADO (candado muerde al Dueño)')

  // (c) Reconfirma y reintenta → 200 + audit anterior→nuevo
  const unlock = await api('POST', '/cambios/desbloquear/', dueno, { password: CAMBIOS_PW })
  assert(unlock.status === 200, '(c) el Dueño reconfirma su contraseña')
  const c = await api('PATCH', `/arrendadores/${arrId}/`, dueno, { cuentaBancaria: 'CTA-NUEVA-9999' })
  const bancoC = (await pool.query(`select cuenta_bancaria c from arrendadores where id=$1`, [arrId])).rows[0].c
  const audit = (await pool.query(
    `select entidad from acciones where accion='Cambió datos bancarios del propietario' and entidad like 'TEST_N1%' order by timestamp desc limit 1`,
  )).rows[0]
  console.log(`    (c) Dueño reconfirmado PATCH {cuentaBancaria} → status=${c.status} · cuenta="${bancoC}"`)
  console.log(`    (c) audit → "${audit?.entidad}"`)
  assert(c.status === 200 && bancoC === 'CTA-NUEVA-9999', '(c) con reconfirmación → 200 y cuenta cambia')
  assert(audit && /CTA-VIEJA-0001.*CTA-NUEVA-9999/.test(audit.entidad), '(c) audit con anterior→nuevo')
  ok('(c) Dueño reconfirma → 200 + audit anterior→nuevo')

  // (d) NO-FUGA: un flujo sensible NO-estricto (DELETE arrendador) sigue exento
  //     para el Dueño. Re-bloquea la sesión y borra → debe pasar sin reconfirmar.
  await api('DELETE', '/cambios/desbloquear/', dueno) // re-bloquea
  const del = await api('DELETE', `/arrendadores/${arr2}/`, dueno)
  console.log(`    (d) Dueño DELETE arrendador (flujo NO-estricto) bloqueado → status=${del.status}`)
  assert(del.status === 200, '(d) el modo estricto NO se fugó: el Dueño sigue exento en flujos no-estrictos')
  ok('(d) no-fuga: DELETE arrendador (no-estricto) sigue exento para el Dueño → 200')

  await limpiar()
  console.log(`\nN-1 OK — ${verdes} aserciones en verde. Estado restaurado (candado ${hashOriginal ? 'ON' : 'OFF'} como estaba).`)
  await pool.end()
}

main().catch(async (e) => {
  console.error('\n' + (e?.message ?? e))
  try { await limpiar() } catch { /* */ }
  await pool.end()
  process.exit(1)
})
