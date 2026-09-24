#!/usr/bin/env node
// ============================================================================
//  preparar-base-2026-09-18.mjs — la base de la que salen las capturas del
//  manual de usuario de septiembre.
// ----------------------------------------------------------------------------
//  Uso (desde la raíz del repo, con el Postgres del 5433 levantado):
//
//    node manuales/preparar-base-2026-09-18.mjs --base=spaces_manual_0924
//
//  Qué hace, en orden:
//    1. BORRA y vuelve a crear esa base (`drop database … with (force)`).
//    2. `db/schema.sql` + `scripts/migrar.mjs --instalacion-nueva`.
//    3. `scripts/semilla-demo.mjs --org=demo-rentabilidad`.
//    4. Una organización VACÍA, `demo-bienvenida`, para el cuestionario de
//       bienvenida (solo aparece si la organización no tiene ninguna razón
//       social, y la de la semilla tiene tres).
//    5. Cuatro cuentas con contraseña aleatoria, que escribe en
//       `manuales/.auth/credenciales-2026-09-18.env` (ignorado por git) con los
//       nombres de variable que espera `capturas-2026-09-18.spec.ts`.
//
//  ─── Por qué una base propia y desechable ─────────────────────────────────
//  El guion de capturas ESCRIBE: da de baja una razón social, asigna un
//  contrato, abre un ticket, captura y borra recibos. Contra la `spaces`
//  compartida del 5433 pisaría el trabajo de otras sesiones, y repetirlo no
//  daría las mismas imágenes. Con esto, cada corrida arranca del mismo sitio.
//
//  ─── Por qué es incómodo de disparar ──────────────────────────────────────
//  Borra una base entera, así que se niega a cualquier nombre que no empiece
//  por `spaces_manual_` y a cualquier servidor que no sea localhost. Es el
//  mismo criterio que `scripts/reiniciar-razones-sociales.mjs`: el borrado
//  accidental es el que nadie decidió.
// ============================================================================
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(RAIZ, 'apps', 'web', 'package.json'))
const pg = require('pg')
const bcrypt = require('bcryptjs')

const base = process.argv.find((a) => a.startsWith('--base='))?.slice(7)
if (!base || !/^spaces_manual_[a-z0-9_]+$/.test(base)) {
  console.error('uso: node manuales/preparar-base-2026-09-18.mjs --base=spaces_manual_<algo>')
  process.exit(1)
}
const HOST = process.env.PGHOST_CAPTURAS ?? 'localhost:5433'
if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(HOST)) {
  console.error(`Solo se prepara una base LOCAL, y ${HOST} no lo es.`)
  process.exit(1)
}
// El superusuario de desarrollo de `db/docker-compose.yml`; el de la app es
// `spaces_app`, que no puede crear bases ni es dueño de las tablas.
const ADMIN = `postgresql://spaces:spaces@${HOST}`
const URL_BASE = `${ADMIN}/${base}`

const admin = new pg.Client({ connectionString: `${ADMIN}/postgres` })
await admin.connect()
await admin.query(`drop database if exists ${base} with (force)`)
await admin.query(`create database ${base}`)
await admin.end()
console.log(`base ${base} recreada`)

const c = new pg.Client({ connectionString: URL_BASE })
await c.connect()
const { readFileSync } = await import('node:fs')
await c.query(readFileSync(join(RAIZ, 'db', 'dev-rol-app.sql'), 'utf8'))
await c.query(readFileSync(join(RAIZ, 'db', 'schema.sql'), 'utf8'))
await c.end()

const correr = (script, args) =>
  execFileSync(process.execPath, [join(RAIZ, 'scripts', script), ...args], {
    env: { ...process.env, DATABASE_URL: URL_BASE },
    stdio: ['ignore', 'ignore', 'inherit'],
  })
correr('migrar.mjs', ['--instalacion-nueva'])
correr('semilla-demo.mjs', ['--org=demo-rentabilidad'])
console.log('esquema, migraciones y semilla aplicados')

const d = new pg.Client({ connectionString: URL_BASE })
await d.connect()
await d.query('begin')
const t1 = (await d.query(`select id from tenants where slug = 'demo-rentabilidad'`)).rows[0].id
await d.query(
  `insert into tenants (nombre, slug, moneda) values ('Organizacion DEMO Bienvenida', 'demo-bienvenida', 'MXN')`,
)
const t2 = (await d.query(`select id from tenants where slug = 'demo-bienvenida'`)).rows[0].id
await d.query(`insert into config_negocio (tenant_id, moneda) values ($1::uuid, 'MXN')`, [t2])

// [variable, rol, nombre, correo, organización, solo_google]
const CUENTAS = [
  ['CAPTURAS', 'DUENO', 'Duena DEMO', 'duena@demo-rentabilidad.invalid', t1, false],
  ['CAPTURAS_OPERACIONES', 'OPERACIONES', 'Operaciones DEMO', 'operaciones@demo-rentabilidad.invalid', t1, false],
  // Con contraseña Y `solo_google`: es la única forma de ver, sin Google, el
  // aviso que da el acceso a una cuenta cerrada a la contraseña (1.3).
  ['CAPTURAS_GOOGLE', 'DUENO', 'Duena DEMO solo Google', 'google@demo-rentabilidad.invalid', t1, true],
  ['CAPTURAS_BIENVENIDA', 'DUENO', 'Duena DEMO Bienvenida', 'duena@demo-bienvenida.invalid', t2, false],
]
const env = []
for (const [v, rol, nombre, correo, tid, soloGoogle] of CUENTAS) {
  const pass = randomBytes(12).toString('base64url')
  // `usuarios` tiene FORCE ROW LEVEL SECURITY: sin el tenant puesto, ni el
  // superusuario pasa el WITH CHECK de la política.
  await d.query(`select set_config('app.tenant_id', $1, true)`, [tid])
  await d.query(
    `insert into usuarios (nombre, email, rol, password_hash, tenant_id, solo_google)
     values ($1, $2, $3::rol_demo, $4, $5::uuid, $6)`,
    [nombre, correo, rol, await bcrypt.hash(pass, 10), tid, soloGoogle],
  )
  env.push(`${v === 'CAPTURAS' ? 'CAPTURAS_USER' : v.replace('CAPTURAS', 'CAPTURAS_USER')}=${correo}`)
  env.push(`${v === 'CAPTURAS' ? 'CAPTURAS_PASS' : v.replace('CAPTURAS', 'CAPTURAS_PASS')}=${pass}`)
}
await d.query('commit')
await d.end()

const salida = join(RAIZ, 'manuales', '.auth', 'credenciales-2026-09-18.env')
mkdirSync(dirname(salida), { recursive: true })
writeFileSync(salida, env.join('\n') + '\n')
console.log(`cuatro cuentas creadas; credenciales en ${salida}`)
