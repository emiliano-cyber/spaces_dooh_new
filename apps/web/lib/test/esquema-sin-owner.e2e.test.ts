import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { Pool } from 'pg'
import { poolTest, cerrarPool, URL_TEST } from './db-e2e'
import { vigilarPool } from './pool-e2e'

// ============================================================================
//  El esquema base NO trae la organización de nadie.
// ----------------------------------------------------------------------------
//  `db/schema.sql` sembraba el tenant 'RGB Catorce' / 'rgb'. En el modelo de
//  instancias soberanas eso significa que CADA instancia nueva —la de PIXELED,
//  la de Telcel, la de quien sea— nacía con la identidad de otro owner dentro,
//  y con su fila de `config_negocio` detrás. Es justo lo que el modelo existe
//  para evitar, y además rompe dos criterios del plan: el de F4.2 («ni una fila
//  de ningún owner») y el de F4.5 (los slugs de DEMO y de `spaces_prod` no
//  pueden compartir ninguno; con el seed, `rgb` estaba en las dos listas).
//
//  Lo que se fija aquí:
//
//    1. Una base recién nacida sale con CERO organizaciones y cero config.
//    2. La receta completa (rol de app → `schema.sql` → runner) sigue en pie:
//       aplica todas las migraciones, deja el mismo número de tablas y la
//       segunda corrida no aplica nada.
//    3. El arranque (`bootstrap-auth.mjs`) CREA la organización de la instancia
//       en vez de heredarla, y sigue abortando ruidosamente cuando lo que falta
//       es algo de verdad — que es la decisión T-01b (13/08) y no se negocia:
//       el no-op silencioso ya costó un despliegue entero.
//
//  El tenant 'rgb' no desaparece del proyecto: vive en
//  `db/semilla-desarrollo.sql`, que NO viaja en la imagen (`Dockerfile:94`
//  copia `schema.sql` y `db/migrations`, y nada más).
// ============================================================================

const RAIZ = join(process.cwd(), '..', '..')
const DIR_MIGRACIONES = join(RAIZ, 'db', 'migrations')
const BASE = 'spaces_sin_owner_e2e'

function urlDe(base: string): string {
  const u = new URL(URL_TEST)
  u.pathname = `/${base}`
  return u.toString()
}

// Las de ESQUEMA del directorio, contadas aquí y no con la función del runner:
// si la expectativa saliera del código que se prueba, no diría nada.
function migracionesDeEsquema(): string[] {
  return readdirSync(DIR_MIGRACIONES)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => {
      const primera = readFileSync(join(DIR_MIGRACIONES, f), 'utf8').split('\n')[0]
      return !/^--\s*@tipo:\s*datos/i.test(primera)
    })
    .sort()
}

function correrRunner(args: string[] = []) {
  return spawnSync(process.execPath, [join('scripts', 'migrar.mjs'), ...args], {
    cwd: RAIZ,
    env: { ...process.env, DATABASE_URL: urlDe(BASE) },
    encoding: 'utf8',
  })
}

// El bootstrap se ejecuta como PROCESO, igual que lo hará el aprovisionamiento:
// lo que hay que probar incluye su código de salida, que es lo único que mira
// un `set -e`.
function correrBootstrap(vars: Record<string, string | undefined>) {
  const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: urlDe(BASE), ...vars }
  for (const [k, v] of Object.entries(vars)) if (v === undefined) delete env[k]
  return spawnSync(process.execPath, [join('scripts', 'bootstrap-auth.mjs')], {
    cwd: join(RAIZ, 'apps', 'web'),
    env,
    encoding: 'utf8',
  })
}

const ORG = { ORG_SLUG: 'instancia-nueva', ORG_NOMBRE: 'Instancia Nueva SA' }
const ADMIN = { ADMIN_EMAIL: 'duena@instancia-nueva.mx', ADMIN_NOMBRE: 'Duena de la instancia' }

async function contar(pool: Pool, sql: string): Promise<number> {
  return (await pool.query(`select count(*)::int as n ${sql}`)).rows[0].n
}

describe('el esquema base no trae la organización de nadie', () => {
  let pool: Pool
  let trasEsquema: { tenants: number; config: number }
  let primera: ReturnType<typeof correrRunner>
  let segunda: ReturnType<typeof correrRunner>
  let trasMigrar: { tenants: number; tablas: number }

  beforeAll(async () => {
    const admin = poolTest()
    if (!BASE.endsWith('_e2e')) throw new Error('la base desechable debe acabar en _e2e')
    await admin.query(`drop database if exists ${BASE} with (force)`)
    await admin.query(`create database ${BASE}`)
    pool = new Pool({ connectionString: urlDe(BASE), max: 2 })
    vigilarPool(pool, BASE)

    // El prólogo real de una instancia: rol de app → `schema.sql`. El rol va
    // PRIMERO porque `20260729_licencias_permisos.sql:96-97` aborta si no
    // encuentra ninguno (mismo motivo que `db-e2e.ts:129-133`).
    await pool.query(readFileSync(join(RAIZ, 'db', 'dev-rol-app.sql'), 'utf8'))
    await pool.query(readFileSync(join(RAIZ, 'db', 'schema.sql'), 'utf8'))
    trasEsquema = {
      tenants: await contar(pool, 'from tenants'),
      config: await contar(pool, 'from config_negocio'),
    }

    primera = correrRunner(['--instalacion-nueva'])
    trasMigrar = {
      tenants: await contar(pool, 'from tenants'),
      tablas: await contar(
        pool,
        `from information_schema.tables
          where table_schema = 'public' and table_type = 'BASE TABLE'`,
      ),
    }
    segunda = correrRunner()
  }, 180_000)

  afterAll(async () => {
    if (pool) await pool.end()
    await poolTest().query(`drop database if exists ${BASE} with (force)`)
    await cerrarPool()
  })

  it('tras `schema.sql` no hay ninguna organización ni su configuración', () => {
    // El hallazgo que motivó esta prueba, en su día: salían 1 y 1 —'RGB
    // Catorce' y su fila de `config_negocio`—, sembradas por un `insert into
    // tenants` y un `update config_negocio … where slug='rgb'` que `schema.sql`
    // traía hasta el 19/08. Hoy en su lugar hay el comentario que explica por
    // qué ya no están (`db/schema.sql:598-611`) y el `insert` genérico de
    // `config_negocio` (`:663-665`), que sin organizaciones no inserta nada.
    expect(trasEsquema).toEqual({ tenants: 0, config: 0 })
  })

  it('la receta completa sigue aplicando todas las migraciones y sale 0', () => {
    expect(primera.stderr).toBe('')
    expect(primera.status).toBe(0)
    expect(primera.stdout).toContain(`${migracionesDeEsquema().length} aplicadas`)
  })

  it('y deja las 39 tablas, sin que ninguna organización se haya colado', () => {
    // 39 es la cuenta medida el 2026-08-19 sobre la receta completa. Si cambia,
    // es porque una migración nueva añadió tabla: se actualiza a conciencia.
    expect(trasMigrar.tablas).toBe(39)
    // Lo que de verdad importa: ni las migraciones resucitan al owner.
    expect(trasMigrar.tenants).toBe(0)
  })

  it('una instancia nueva nace PIDIENDO la contrasena en los cambios sensibles', async () => {
    // `tenants.exigir_reautenticacion` decide si `exigirDesbloqueo()`
    // (`lib/server/cambios.ts:199-210`) pide la contraseña o deja pasar. Nació
    // con `default false` en `20260804_reautenticacion_individual.sql:34`, y
    // **nada en las semillas ni en el aprovisionamiento lo toca**: cada
    // instancia nueva arrancaba con el candado abierto.
    //
    // Eso deja OCHO rutas sensibles sin pedir nada, y tres de ellas mueven
    // dinero: `campanas/[id]/facturar`, `cobranzas/[id]/pagar` y
    // `pagos-renta/[id]/pagar`. El permiso del rol sigue aplicando —no es que
    // pueda facturar cualquiera— pero nadie comprueba que quien está al teclado
    // sea de verdad esa persona y no alguien que encontró la sesión abierta.
    //
    // ─── Por qué el DEFAULT y no un `update` ─────────────────────────────────
    // Encenderlo en las bases de hoy no sirve para la flota: una instancia nace
    // de `schema.sql` + migraciones, así que hereda el DEFAULT y no los datos de
    // nadie. Cambiarlo aquí es lo único que hace que la decisión dure.
    //
    // Sigue siendo un interruptor: el Dueño que no quiera la fricción lo apaga.
    // Lo que cambia es la polaridad — se apaga a propósito en vez de encenderse
    // a propósito, que es lo que el ADR 0009 pretendía.
    //
    // Y la fricción es menor de lo que suena: el desbloqueo dura
    // `DESBLOQUEO_MINUTOS = 15` (`cambios.ts:49`), así que facturar diez
    // campañas seguidas pide la contraseña UNA vez.
    const r = await pool.query<{ def: string | null }>(
      `select pg_get_expr(d.adbin, d.adrelid) as def
         from pg_attrdef d
         join pg_class c on c.oid = d.adrelid
         join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
        where c.relname = 'tenants' and a.attname = 'exigir_reautenticacion'`,
    )
    expect(r.rows[0]?.def, 'la columna no tiene DEFAULT').toBeTruthy()
    expect(r.rows[0]?.def).toMatch(/true/)
  })

  it('la segunda corrida del runner no aplica nada', () => {
    expect(segunda.status).toBe(0)
    expect(segunda.stdout).toMatch(/0 aplicadas/)
  })

  // ── El arranque ──────────────────────────────────────────────────────────

  it('el arranque aborta si no le dicen de quién es la instancia', async () => {
    // Mismo criterio que con `DATABASE_URL` (T-02): un bootstrap que adivina la
    // identidad del owner es como uno que adivina la base. Y sin defaults: un
    // default aquí es precisamente el tenant horneado que esta tarea retira.
    const r = correrBootstrap({ ...ADMIN, ORG_SLUG: undefined, ORG_NOMBRE: undefined })
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('ORG_SLUG')
    expect(r.stderr).toContain('ORG_NOMBRE')
    expect(r.stderr).not.toMatch(/^\s+at /m)
    expect(await contar(pool, 'from tenants')).toBe(0)
  })

  it('el arranque CREA la organización y su Dueño, sin heredar ninguna', async () => {
    const r = correrBootstrap({ ...ORG, ...ADMIN })
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)

    const { rows } = await pool.query('select nombre, slug from tenants')
    expect(rows).toEqual([{ nombre: ORG.ORG_NOMBRE, slug: ORG.ORG_SLUG }])

    const u = await pool.query(
      `select u.email, u.rol from usuarios u
         join tenants t on t.id = u.tenant_id where t.slug = $1`,
      [ORG.ORG_SLUG],
    )
    expect(u.rows).toEqual([{ email: ADMIN.ADMIN_EMAIL, rol: 'DUENO' }])
    // Y los permisos por rol, que es la otra mitad del bootstrap.
    expect(await contar(pool, 'from rol_permisos')).toBeGreaterThan(0)
  }, 60_000)

  it('correrlo dos veces no crea una segunda organización', async () => {
    const r = correrBootstrap({ ...ORG, ...ADMIN })
    expect(r.status).toBe(0)
    expect(await contar(pool, 'from tenants')).toBe(1)
    expect(await contar(pool, 'from usuarios')).toBe(1)
  }, 60_000)

  it('sigue abortando cuando la organización no llega a existir de verdad', async () => {
    // El guard de T-01b, que NO se puede perder: esa forma de insert
    // (`insert … select … from tenants where slug = $`) afecta 0 filas y
    // termina CON ÉXITO si la organización no está. El operador creería que
    // sembró y la base quedaría sin usuario — el no-op silencioso de R2.
    //
    // Se fabrica con un trigger que se traga el insert sin dar error, que es la
    // forma barata de reproducir «la organización no quedó creada».
    await pool.query(`create or replace function tragarse_insert() returns trigger
                        language plpgsql as $$ begin return null; end $$`)
    await pool.query(`create trigger tragarse_insert before insert on tenants
                        for each row execute function tragarse_insert()`)
    await pool.query('delete from usuarios')
    await pool.query('delete from tenants')
    try {
      const r = correrBootstrap({ ...ORG, ...ADMIN, ORG_SLUG: 'fantasma' })
      expect(r.status).toBe(1)
      expect(r.stderr).toContain('fantasma')
      expect(r.stderr).not.toMatch(/^\s+at /m)
      expect(await contar(pool, 'from usuarios')).toBe(0)
    } finally {
      await pool.query('drop trigger if exists tragarse_insert on tenants')
      await pool.query('drop function if exists tragarse_insert()')
    }
  }, 60_000)
})
