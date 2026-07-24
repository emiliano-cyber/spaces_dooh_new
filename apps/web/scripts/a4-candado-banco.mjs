// ============================================================================
//  a4-candado-banco.mjs — Gate de la Fase 2 (A-4): candado del Dueño en los
//  datos bancarios del arrendador + audit inmutable anterior→nuevo.
//
//  IMPORTANTE: en el RBAC actual SOLO el rol DUENO tiene 'arrendadores.crear', y
//  DUENO está EXENTO del candado (ROL_SIN_CANDADO). Es decir, el candado hoy no
//  bloquea a nadie. Para EJERCITAR el código del candado, este test crea de forma
//  sintética un usuario COMERCIAL de prueba y le concede 'arrendadores.crear',
//  activa el control de cambios, corre las 3 vías y REVIERTE todo al final.
//  (El hallazgo del RBAC se reporta aparte; aquí solo se prueba el código.)
//
//  Uso: node scripts/a4-candado-banco.mjs   (requiere dev server en :3000)
// ============================================================================
import pg from 'pg'

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:3000/spaces-dooh/api'
const DB = process.env.DATABASE_URL ?? 'postgresql://spaces:spaces@localhost:5433/spaces'
const DUENO_EMAIL = 'jose@pixeled.com.mx'
const DUENO_PW = 'spaces123'
const CAMBIOS_PW = 'CandadoTest.2026'
const TEST_EMAIL = 'test_comercial_a4@spaces.local'
const TEST_PW = 'Comercial.Test1'

const pool = new pg.Pool({ connectionString: DB })
let verdes = 0
const ok = (m) => { verdes++; console.log(`  ✓ ${m}`) }
const assert = (c, m) => { if (!c) throw new Error(`✗ FALLA: ${m}`) }

async function login(email, pw) {
  const r = await fetch(`${BASE}/auth/login/`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: pw }),
  })
  const sc = r.headers.getSetCookie?.() ?? []
  const ses = sc.find((x) => x.startsWith('spaces_sesion='))
  const csrfSet = sc.find((x) => x.startsWith('spaces_csrf='))
  if (!ses) throw new Error(`login falló (${email}) status ${r.status}`)
  const csrf = csrfSet ? csrfSet.split(';')[0].split('=')[1] : ''
  const cookie = [ses.split(';')[0], csrfSet ? csrfSet.split(';')[0] : ''].filter(Boolean).join('; ')
  return { cookie, csrf }
}
async function api(method, path, ses, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', cookie: ses.cookie, 'x-csrf-token': ses.csrf },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  let data = null
  try { data = await r.json() } catch { /* */ }
  return { status: r.status, data }
}

const TENANT = 'd8e51e47-2205-48d0-b087-07ba2478bcf2'
let hashOriginal = null       // para restaurar el control de cambios exacto
let permisoConcedido = false  // para revertir el grant a COMERCIAL
let arrId = null

async function limpiar() {
  // Restaura el control de cambios al valor original (CRÍTICO: no dejarlo activo)
  await pool.query(`update tenants set cambios_password_hash=$2 where id=$1`, [TENANT, hashOriginal])
  // Revierte el permiso concedido a COMERCIAL
  if (permisoConcedido) {
    await pool.query(`delete from rol_permisos where rol='COMERCIAL' and modulo='arrendadores' and accion='crear'`)
  }
  if (arrId) await pool.query(`delete from arrendadores where id=$1`, [arrId])
  // El usuario de prueba generó filas en la bitácora inmutable (acciones). Su FK
  // es ON DELETE SET NULL, y ese UPDATE lo BLOQUEA el trigger append-only: el
  // usuario no se puede hard-borrar desde la app (correcto: integridad del audit).
  // Fallback: desactivarlo. La limpieza total (borrar sus filas de audit) exige
  // bypass de DBA (session_replication_role=replica).
  try {
    await pool.query(`delete from usuarios where email=$1`, [TEST_EMAIL])
  } catch {
    await pool.query(`update usuarios set activo=false where email=$1`, [TEST_EMAIL])
  }
}

async function main() {
  console.log('A-4 CANDADO DATOS BANCARIOS — control de cambios + audit\n')

  // Estado a restaurar
  hashOriginal = (await pool.query(`select cambios_password_hash h from tenants where id=$1`, [TENANT])).rows[0]?.h ?? null
  const yaTenia = (await pool.query(`select 1 from rol_permisos where rol='COMERCIAL' and modulo='arrendadores' and accion='crear'`)).rowCount > 0

  const dueno = await login(DUENO_EMAIL, DUENO_PW); ok('login Dueño')

  // ── Setup sintético ────────────────────────────────────────────────────────
  // Idempotente: si una corrida previa dejó el usuario (no se pudo hard-borrar
  // por el audit inmutable), se reactiva y reusa; si no, se crea.
  await pool.query(`delete from usuarios where email=$1`, [TEST_EMAIL]).catch(() => {})
  const existe = (await pool.query(`select 1 from usuarios where email=$1`, [TEST_EMAIL])).rowCount > 0
  if (existe) {
    await pool.query(`update usuarios set activo=true, rol='COMERCIAL' where email=$1`, [TEST_EMAIL])
  } else {
    const cu = await api('POST', '/usuarios/', dueno, {
      nombre: 'TEST_Comercial_A4', email: TEST_EMAIL, rol: 'COMERCIAL', password: TEST_PW,
    })
    assert(cu.status === 201 || cu.status === 200, `crear usuario COMERCIAL de prueba (status ${cu.status})`)
  }
  if (!yaTenia) {
    await pool.query(`insert into rol_permisos (rol,modulo,accion) values ('COMERCIAL','arrendadores','crear') on conflict do nothing`)
    permisoConcedido = true
  }
  arrId = (await pool.query(
    `insert into arrendadores (nombre, cuenta_bancaria, forma_pago, tenant_id) values ('TEST_Arrendador_A4','CTA-VIEJA-0001','TRANSFERENCIA',$1) returning id`,
    [TENANT],
  )).rows[0].id
  // Activa el control de cambios (hash real vía API del Dueño)
  const setpw = await api('PUT', '/cambios/', dueno, { password: CAMBIOS_PW })
  assert(setpw.status === 200 && setpw.data?.activo === true, 'activar control de cambios')
  ok('setup: usuario COMERCIAL + permiso arrendadores.crear + arrendador + candado ON')

  // ── Sesión del COMERCIAL (sujeta al candado, BLOQUEADA) ─────────────────────
  const com = await login(TEST_EMAIL, TEST_PW); ok('login COMERCIAL de prueba (sesión bloqueada)')

  // (a) Campo NO sensible, sin desbloqueo → 200 (flujo normal intacto)
  const a = await api('PATCH', `/arrendadores/${arrId}/`, com, { telefono: '5555555555' })
  console.log(`    (a) PATCH {telefono} sin candado → status=${a.status}`)
  assert(a.status === 200, '(a) campo no sensible pasa sin desbloqueo')
  ok('(a) editar campo NO sensible sin candado → 200')

  // (b) cuenta_bancaria SIN desbloqueo → rechazado (403 + requiereDesbloqueo)
  const b = await api('PATCH', `/arrendadores/${arrId}/`, com, { cuentaBancaria: 'CTA-NUEVA-9999' })
  const bancoTrasB = (await pool.query(`select cuenta_bancaria c from arrendadores where id=$1`, [arrId])).rows[0].c
  console.log(`    (b) PATCH {cuentaBancaria} sin candado → status=${b.status} requiereDesbloqueo=${b.data?.requiereDesbloqueo} · cuenta_en_bd="${bancoTrasB}"`)
  assert(b.status === 403 && b.data?.requiereDesbloqueo === true, '(b) datos bancarios sin desbloqueo → 403 requiereDesbloqueo')
  assert(bancoTrasB === 'CTA-VIEJA-0001', '(b) la cuenta NO cambió (rechazo efectivo)')
  ok('(b) cambiar cuenta bancaria SIN candado → rechazado, sin efecto')

  // (c) Desbloquear con la contraseña del Dueño y reintentar → 200 + audit
  const unlock = await api('POST', '/cambios/desbloquear/', com, { password: CAMBIOS_PW })
  assert(unlock.status === 200, '(c) desbloqueo con contraseña del Dueño')
  const c = await api('PATCH', `/arrendadores/${arrId}/`, com, { cuentaBancaria: 'CTA-NUEVA-9999' })
  const bancoTrasC = (await pool.query(`select cuenta_bancaria c from arrendadores where id=$1`, [arrId])).rows[0].c
  const audit = (await pool.query(
    `select accion, entidad from acciones where accion='Cambió datos bancarios del propietario' and entidad like 'TEST_Arrendador_A4%' order by timestamp desc limit 1`,
  )).rows[0]
  console.log(`    (c) PATCH {cuentaBancaria} con candado → status=${c.status} · cuenta_en_bd="${bancoTrasC}"`)
  console.log(`    (c) audit inmutable → accion="${audit?.accion}" entidad="${audit?.entidad}"`)
  assert(c.status === 200, '(c) datos bancarios CON desbloqueo → 200')
  assert(bancoTrasC === 'CTA-NUEVA-9999', '(c) la cuenta SÍ cambió')
  assert(audit && /CTA-VIEJA-0001.*CTA-NUEVA-9999/.test(audit.entidad), '(c) audit con valor anterior→nuevo')
  ok('(c) cambiar cuenta bancaria CON candado → 200 + audit anterior→nuevo')

  await limpiar()
  console.log(`\nA-4 CANDADO OK — ${verdes} aserciones en verde. Estado restaurado (candado ${hashOriginal ? 'ON' : 'OFF'} como estaba).`)
  await pool.end()
}

main().catch(async (e) => {
  console.error('\n' + (e?.message ?? e))
  try { await limpiar() } catch (err) { console.error('teardown falló:', err?.message) }
  await pool.end()
  process.exit(1)
})
