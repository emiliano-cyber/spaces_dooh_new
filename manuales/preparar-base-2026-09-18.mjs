#!/usr/bin/env node
// ============================================================================
//  preparar-base-2026-09-18.mjs — la base de la que salen las capturas del
//  manual de usuario de septiembre.
// ----------------------------------------------------------------------------
//  Uso (desde la raíz del repo, con el Postgres del 5433 levantado):
//
//    node manuales/preparar-base-2026-09-18.mjs --base=spaces_manual_0924
//    node manuales/preparar-base-2026-09-18.mjs --base=spaces_manual_0924 --version-disponible
//
//  La segunda forma NO recrea nada: solo escribe en `actualizaciones_instancia`
//  lo que dejaría el actualizador del servidor tras encontrar una versión nueva
//  en el registro (ver «versión disponible», abajo). La llama el guion de
//  capturas justo antes del apartado 6.3.
//
//  Qué hace, en orden:
//    1. BORRA y vuelve a crear esa base (`drop database … with (force)`).
//    2. `db/schema.sql` + `scripts/migrar.mjs --instalacion-nueva`.
//    3. `scripts/semilla-demo.mjs --org=demo-rentabilidad`.
//    4. Una organización VACÍA, `demo-bienvenida`, para el cuestionario de
//       bienvenida (solo aparece si la organización no tiene ninguna razón
//       social, y la de la semilla tiene tres).
//    4b. Dos campañas LISTAS PARA FACTURAR (candado completo, sin comprobante)
//       en demo-rentabilidad, para el apartado 4.2: la semilla deja las ocho
//       suyas ya facturadas. Van sin reservas a propósito, para no mover ni un
//       peso de los reportes de rentabilidad que fotografía el apartado 9.
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

// ─── «Versión disponible», preparada a mano ────────────────────────────────
// En una instancia real estas columnas las escribe el ACTUALIZADOR del
// servidor (`infra/scripts/update.sh`) tras leer el registro de imágenes, con
// el rol privilegiado; la aplicación no puede, por el `grant update` por
// columna de `20260921_actualizaciones_instancia.sql`. En local no hay
// actualizador ni registro, así que se escribe lo mismo que dejaría él. Los
// digests son inventados y lo dicen: `sha256:local-manual-…`. El manual lo
// declara en el pie de cada captura del 6.3.
if (process.argv.includes('--version-disponible')) {
  const v = new pg.Client({ connectionString: URL_BASE })
  await v.connect()
  await v.query(
    `update actualizaciones_instancia
        set version_instalada = 'v0.7.0',
            digest_instalado  = 'sha256:local-manual-instalada',
            version_disponible = 'v0.8.0',
            digest_disponible  = 'sha256:local-manual-disponible',
            migraciones_pendientes = 2,
            comprobado_en = now(),
            modo = 'aprobacion',
            aprobado_digest = null, aprobado_por = null, aprobado_en = null,
            actualizado_en = now()
      where id`,
  )
  await v.end()
  console.log(`${base}: actualizaciones_instancia con v0.8.0 disponible sobre v0.7.0 (preparado a mano)`)
  process.exit(0)
}

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

// 4b. Campañas listas para facturar. OOH, así que el candado pide OC recibida
// y fotos comprobatorias (`candadoDeSegmentos`, `lib/data/derive.ts`); el
// reporte de publicación también va en `true` para que no dependa del tipo.
// `campanas` tiene FORCE ROW LEVEL SECURITY: el tenant va puesto.
await d.query(`select set_config('app.tenant_id', $1, true)`, [t1])
for (const [folio, nombre, rfc, neto] of [
  ['DEMO-CMP-FACTURABLE-1', 'Campana DEMO Bebidas del Valle 2026-T3 lista', 'DMO010101BB1', 120000],
  ['DEMO-CMP-FACTURABLE-2', 'Campana DEMO Banca Ejemplo 2026-T3 lista', 'DMO010101BB2', 90000],
]) {
  const r = await d.query(
    `insert into campanas (tenant_id, folio, nombre, cliente_id, tipo_campana, fecha_inicio, fecha_fin,
                           presupuesto_bruto, presupuesto_neto, moneda, estado_comercial,
                           oc_recibida, fotos_comprobatorias, reporte_publicacion, notas)
     select $1::uuid, $2, $3, cl.id, 'OOH', '2026-07-01', '2026-08-31',
            $4::numeric * 1.16, $4::numeric, 'MXN', 'COMPLETADA', true, true, true,
            'Sembrada por manuales/preparar-base-2026-09-18.mjs para el apartado 4.2'
       from clientes cl where cl.tenant_id = $1::uuid and cl.rfc = $5`,
    [t1, folio, nombre, neto, rfc],
  )
  if (r.rowCount !== 1) throw new Error(`No se pudo sembrar ${folio}: ¿cambió el RFC del cliente en la semilla?`)
}

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
