import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'
import { poolTest, cerrarPool, URL_TEST } from './db-e2e'

// ============================================================================
//  El alta de una instancia: `apps/web/scripts/bootstrap-auth.mjs`.
// ----------------------------------------------------------------------------
//  Crea la organización de la instancia y su Dueño. Es lo ÚNICO que debe ser
//  distinto en cada droplet — la identidad. Todo lo que sea igual para toda la
//  flota (el catálogo de permisos, el esquema) viaja en las migraciones.
//
//  Hasta el 2026-08-20 el alta también sembraba permisos, con su propia MATRIZ
//  (`bootstrap-auth.mjs:90-99` hasta `de6860a`, 36 filas) que no coincidía con la de la
//  migración (25). Eran DOS catálogos que podían divergir, y la política de
//  acceso efectiva de una instancia la fijaba el último script que corrió. Eso
//  es ROJO-2, y se cierra por los dos lados: la migración adopta el catálogo
//  completo (41) y el alta deja de tener el suyo.
// ============================================================================

const RAIZ = join(process.cwd(), '..', '..')
const BASE_ALTA = 'spaces_alta_e2e'
// La segunda: una base que tiene el esquema pero NO las migraciones, o sea sin
// catálogo de permisos. Es el estado en que quedaría una instancia si alguien
// corriera el alta antes de migrar.
const BASE_SIN_CATALOGO = 'spaces_alta_sin_catalogo_e2e'

function urlDe(base: string): string {
  const u = new URL(URL_TEST)
  u.pathname = `/${base}`
  return u.toString()
}

const sql = (...partes: string[]) => readFileSync(join(RAIZ, 'db', ...partes), 'utf8')

async function crearBase(nombre: string): Promise<Pool> {
  if (!nombre.endsWith('_e2e')) throw new Error('la base desechable debe acabar en _e2e')
  const admin = poolTest()
  await admin.query(`drop database if exists ${nombre} with (force)`)
  await admin.query(`create database ${nombre}`)
  const pool = new Pool({ connectionString: urlDe(nombre), max: 2 })
  // El prólogo real de una instancia: rol de app → `schema.sql`. El rol va
  // PRIMERO porque `20260729_licencias_permisos.sql:96-97` aborta si no
  // encuentra ninguno, y desde el 20/08 el runner ni siquiera empieza sin él.
  await pool.query(sql('dev-rol-app.sql'))
  await pool.query(sql('schema.sql'))
  return pool
}

// El alta, tal como la corre el aprovisionamiento: las cinco variables
// obligatorias y ni una más.
function correrAlta(base: string, extra: Record<string, string> = {}) {
  return spawnSync(process.execPath, [join('scripts', 'bootstrap-auth.mjs')], {
    cwd: join(RAIZ, 'apps', 'web'),
    env: {
      ...process.env,
      DATABASE_URL: urlDe(base),
      ORG_SLUG: 'alta-e2e',
      ORG_NOMBRE: 'Organizacion de prueba',
      ADMIN_EMAIL: 'duenia@alta.test',
      ADMIN_NOMBRE: 'Duena de prueba',
      ...extra,
    },
    encoding: 'utf8',
  })
}

async function catalogoDe(pool: Pool): Promise<string[]> {
  const { rows } = await pool.query(
    "select rol || '|' || modulo || '|' || accion as fila from rol_permisos order by 1",
  )
  return rows.map((r: any) => r.fila)
}

describe('el alta ya no siembra el catálogo de permisos', () => {
  let pool: Pool
  let sinCatalogo: Pool
  let antes: string[]
  let alta: ReturnType<typeof correrAlta>

  beforeAll(async () => {
    pool = await crearBase(BASE_ALTA)
    // La receta completa: sin las migraciones no hay catálogo, y lo que se
    // quiere medir es justamente que el alta no lo toca.
    const runner = spawnSync(process.execPath, [join('scripts', 'migrar.mjs'), '--instalacion-nueva'], {
      cwd: RAIZ,
      env: { ...process.env, DATABASE_URL: urlDe(BASE_ALTA) },
      encoding: 'utf8',
    })
    if (runner.status !== 0) throw new Error(`el runner fallo: ${runner.stderr}`)
    antes = await catalogoDe(pool)
    alta = correrAlta(BASE_ALTA)
  }, 180_000)

  afterAll(async () => {
    if (pool) await pool.end()
    if (sinCatalogo) await sinCatalogo.end()
    const admin = poolTest()
    await admin.query(`drop database if exists ${BASE_ALTA} with (force)`)
    await admin.query(`drop database if exists ${BASE_SIN_CATALOGO} with (force)`)
    await cerrarPool()
  })

  it('el escenario parte del catálogo completo', () => {
    // Si esto fallara, lo de abajo mediría que el alta no toca una tabla vacía.
    expect(antes).toHaveLength(41)
  })

  it('el alta corre y crea la identidad de la instancia', async () => {
    expect(alta.stderr).toBe('')
    expect(alta.status).toBe(0)
    const { rows } = await pool.query(
      "select t.slug, u.email, u.rol::text as rol from usuarios u join tenants t on t.id = u.tenant_id",
    )
    expect(rows).toEqual([{ slug: 'alta-e2e', email: 'duenia@alta.test', rol: 'DUENO' }])
  })

  it('y NO cambia ni una fila del catálogo', async () => {
    // El corazón de ROJO-2: dos catálogos que podían divergir, y ganaba el que
    // corriera último. Ahora solo hay uno y el alta no lo toca.
    expect(await catalogoDe(pool)).toEqual(antes)
  })

  it('el script ya no lleva su propia matriz de permisos', () => {
    // La prueba de arriba pasaría igual si la MATRIZ siguiera ahí y coincidiera
    // por casualidad con la migración. Lo que hace que no puedan divergir NUNCA
    // es que solo exista una, y eso se mide leyendo el archivo.
    const fuente = readFileSync(join(RAIZ, 'apps', 'web', 'scripts', 'bootstrap-auth.mjs'), 'utf8')
    expect(fuente).not.toMatch(/const\s+MATRIZ/)
    expect(fuente).not.toMatch(/insert\s+into\s+rol_permisos/i)
  })

  it('sin catálogo, el alta se NIEGA en vez de entregar una instancia inservible', async () => {
    // `permisosDeRol` y `tienePermiso` (`lib/server/auth.ts`) son consultas
    // directas a `rol_permisos`, sin excepción para el Dueño, y `exigir()` es
    // fail-closed. Un alta que termina «bien» sobre una base sin catálogo
    // entrega una instancia donde el Dueño entra y no puede abrir nada — ni
    // Administración, desde donde daría de alta a su equipo. Mismo criterio que
    // T-01b (13/08): el no-op silencioso es el modo de fallo que ya costó un
    // despliegue.
    sinCatalogo = await crearBase(BASE_SIN_CATALOGO)
    expect((await catalogoDe(sinCatalogo)).length).toBe(0)

    const r = correrAlta(BASE_SIN_CATALOGO)
    expect(r.status).not.toBe(0)
    expect(r.stderr).toMatch(/rol_permisos|permisos/i)
    expect(r.stderr).toMatch(/migra/i)
    // Y no deja a medias lo que no pudo terminar: sin catálogo, sin Dueño.
    const { rows } = await sinCatalogo.query('select count(*)::int n from usuarios')
    expect(rows[0].n).toBe(0)
  }, 60_000)
})

describe('el Dueño ya no nace con una contraseña compartida', () => {
  // ── ROJO-1, medido en el re-ensayo de la Fase 4 ─────────────────────────
  //
  //  `bootstrap-auth.mjs:85` (hasta `a2353d6`) sembraba `SEED_PASSWORD ?? 'spaces123'` y la
  //  imprimía. En el ensayo se entró con ella y el correo público del Dueño:
  //  HTTP 200, sesión válida y los nueve módulos, incluidos `administracion` y
  //  `finanzas`. Idéntica en toda la flota, y bcrypt no protege de eso — no hay
  //  que romperla, hay que teclearla.
  //
  //  Y el insert NO tocaba `debe_cambiar_password`, cuya columna es
  //  `not null default false` (`20260804_reautenticacion_individual.sql:35`):
  //  el Dueño nacía con una contraseña conocida Y sin obligación de cambiarla,
  //  que es la peor combinación de las dos.
  //
  //  Las piezas del arreglo ya existían: `restablecerPasswordCtrl`
  //  (`usuarios-controller.ts:122`) hace este flujo entero para el
  //  restablecimiento, y `exigir()` (`auth.ts:167`) corta con 403 mientras la
  //  marca esté puesta, dejando abiertas a propósito `/api/auth/me` y
  //  `/api/perfil` para que el usuario pueda salir del estado.

  let pool: Pool
  let alta: ReturnType<typeof correrAlta>
  let segunda: ReturnType<typeof correrAlta>
  let hashInicial: string

  const BASE_PW = 'spaces_alta_pw_e2e'

  beforeAll(async () => {
    pool = await crearBase(BASE_PW)
    const runner = spawnSync(process.execPath, [join('scripts', 'migrar.mjs'), '--instalacion-nueva'], {
      cwd: RAIZ,
      env: { ...process.env, DATABASE_URL: urlDe(BASE_PW) },
      encoding: 'utf8',
    })
    if (runner.status !== 0) throw new Error(`el runner fallo: ${runner.stderr}`)
    alta = correrAlta(BASE_PW)
    const { rows } = await pool.query('select password_hash from usuarios')
    hashInicial = rows[0]?.password_hash
  }, 180_000)

  afterAll(async () => {
    if (pool) await pool.end()
    await poolTest().query(`drop database if exists ${BASE_PW} with (force)`)
  })

  it('la contraseña compartida ya no se USA en el alta', () => {
    // Se mide el USO, no la prosa: el comentario que explica el defecto nombra
    // `spaces123` y `SEED_PASSWORD` a propósito — es lo único que impide que
    // vuelvan. Lo que no puede quedar es una asignación ni una lectura.
    const fuente = readFileSync(join(RAIZ, 'apps', 'web', 'scripts', 'bootstrap-auth.mjs'), 'utf8')
    const codigo = fuente.replace(/^\s*\/\/.*$/gm, '')
    expect(codigo).not.toMatch(/spaces123/)
    expect(codigo).not.toMatch(/SEED_PASSWORD/)
    expect(codigo).toMatch(/generarPasswordTemporal\(\)/)
  })

  it('y la que quedó guardada NO es "spaces123"', async () => {
    expect(alta.status).toBe(0)
    expect(hashInicial).toBeTruthy()
    expect(await bcrypt.compare('spaces123', hashInicial)).toBe(false)
  })

  it('el alta la entrega UNA vez, y es la que de verdad quedó', async () => {
    // Se lee del stdout como la leería quien corre el alta. Si el script dejara
    // de imprimirla, el Dueño no podría entrar y nadie se enteraría hasta el
    // primer intento.
    const m = alta.stdout.match(/[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/)
    expect(m, `el alta no imprimio ninguna contrasena temporal:\n${alta.stdout}`).toBeTruthy()
    expect(await bcrypt.compare(m![0], hashInicial)).toBe(true)
  })

  it('nace OBLIGADO a cambiarla', async () => {
    const { rows } = await pool.query('select debe_cambiar_password from usuarios')
    expect(rows[0].debe_cambiar_password).toBe(true)
  })

  it('correrlo dos veces NO le rota la contraseña al Dueño', async () => {
    // Con una contraseña fija daba igual: la reescribía con la misma. Con una
    // generada, el `on conflict do update` de antes dejaría al Dueño fuera de su
    // propia instancia cada vez que alguien repitiera el alta — y el script se
    // anuncia como idempotente.
    segunda = correrAlta(BASE_PW)
    expect(segunda.status).toBe(0)
    const { rows } = await pool.query('select password_hash from usuarios')
    expect(rows[0].password_hash).toBe(hashInicial)
    // Y lo dice, en vez de callar: quien repite el alta tiene que saber que la
    // contraseña que imprimió la primera vez sigue siendo la buena.
    expect(segunda.stdout).toMatch(/ya exist/i)
  }, 60_000)
})
