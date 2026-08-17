import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { Pool } from 'pg'
import { recrearEsquema, poolTest, cerrarPool, URL_TEST } from './db-e2e'
// Solo para MONTAR el escenario de la instancia rezagada: aplicar su historia
// en el orden real. Las expectativas de estas pruebas nunca salen de aquí.
import { ordenar } from '../../../../scripts/migrar.mjs'

// ============================================================================
//  `schema_migrations` — cada instancia sabe qué migraciones ya corrió.
// ----------------------------------------------------------------------------
//  Hoy no hay tabla de control: el despliegue reaplica TODAS las migraciones en
//  cada corrida y confía en que sean idempotentes (`deploy.yml:141-148`).
//  Funciona mientras haya una sola instancia y una persona mirando; con una
//  flota, no saber en qué versión de esquema está cada droplet es el problema.
//
//  Lo que estas pruebas defienden no es que la tabla exista —eso es lo fácil—
//  sino que su CONTENIDO no mienta:
//
//    · una base con historia (la del droplet actual) no debe reejecutarla;
//    · una base recién creada debe quedar con la tabla VACÍA, para que el runner
//      de F3.2 aplique las migraciones de verdad en vez de darlas por hechas.
//
//  Las dos mitades son el mismo riesgo por los dos lados: un backfill que no
//  dispara reaplica la historia; uno que dispara de más se salta migraciones que
//  nunca corrieron y deja el esquema incompleto SIN dar error.
// ============================================================================

const DIR_MIGRACIONES = join(process.cwd(), '..', '..', 'db', 'migrations')
const ARCHIVO = '20260812_schema_migrations.sql'
const SQL = () => readFileSync(join(DIR_MIGRACIONES, ARCHIVO), 'utf8')

// Base desechable para el caso «instalación nueva». Hace falta una base APARTE
// de verdad: `spaces_e2e` la deja poblada `recrearEsquema()` (`schema.sql:598`
// siembra el tenant 'rgb'), así que ahí el backfill SIEMPRE dispara y el caso de
// la base virgen no se podría distinguir. El nombre acaba en `_e2e` a propósito:
// es la misma disciplina que exige `exigirBaseDePrueba()` en `db-e2e.ts:39-56`.
const BASE_VIRGEN = 'spaces_virgen_e2e'

function urlDe(base: string): string {
  const u = new URL(URL_TEST)
  u.pathname = `/${base}`
  return u.toString()
}

beforeAll(async () => {
  await recrearEsquema()
}, 60_000)

afterAll(async () => {
  await cerrarPool()
})

describe('registro de migraciones aplicadas', () => {
  it('existe schema_migrations con (archivo pk, checksum, aplicada_en, tipo)', async () => {
    const { rows } = await poolTest().query(
      `select column_name, is_nullable from information_schema.columns
        where table_schema = 'public' and table_name = 'schema_migrations'
        order by column_name`,
    )
    expect(rows.map((r: any) => r.column_name)).toEqual([
      'aplicada_en',
      'archivo',
      'checksum',
      'tipo',
    ])

    // `archivo` es la clave: es lo que hace que registrar dos veces la misma
    // migración sea imposible, y de eso depende el `on conflict do nothing` del
    // runner.
    const pk = await poolTest().query(
      `select a.attname from pg_index i
         join pg_class c on c.oid = i.indrelid
         join pg_attribute a on a.attrelid = c.oid and a.attnum = any(i.indkey)
        where c.relname = 'schema_migrations' and i.indisprimary`,
    )
    expect(pk.rows.map((r: any) => r.attname)).toEqual(['archivo'])
  })

  it('la tabla queda EXENTA de RLS, como folios_consecutivos', async () => {
    // No es un olvido: es infraestructura de la instancia, no dato de negocio.
    // No tiene `tenant_id` y el runner la lee antes de que exista sesión alguna;
    // con RLS activa y sin `app.tenant_id` fijado devolvería cero filas y el
    // runner concluiría que no hay nada aplicado. Mismo criterio que
    // `folios_consecutivos` (`db/schema.sql:93-99`).
    const { rows } = await poolTest().query(
      `select relname, relrowsecurity from pg_class
        where relname in ('schema_migrations', 'folios_consecutivos')
        order by relname`,
    )
    expect(rows).toEqual([
      { relname: 'folios_consecutivos', relrowsecurity: false },
      { relname: 'schema_migrations', relrowsecurity: false },
    ])
  })

  it('una base con historia NO reejecuta su pasado: queda backfilleada', async () => {
    // `recrearEsquema()` deja la base como el droplet: `schema.sql` (que siembra
    // el tenant 'rgb') más todas las migraciones. Ahí el backfill debe haber
    // disparado.
    const { rows } = await poolTest().query(
      'select archivo, checksum, tipo from schema_migrations order by archivo',
    )
    expect(rows.length).toBeGreaterThan(0)
    for (const fila of rows) expect(fila.checksum).toBe('backfill')

    // Las de esquema anteriores al corte, todas. Se compara contra el
    // DIRECTORIO, no contra una lista escrita aquí: si alguien añade una
    // migración con fecha vieja y no la mete en el backfill, esto se pone rojo.
    const esperadas = readdirSync(DIR_MIGRACIONES)
      .filter((f) => f.endsWith('.sql') && f < '20260812')
      .filter((f) => !/^-- *@tipo: *datos/im.test(readFileSync(join(DIR_MIGRACIONES, f), 'utf8')))
      .sort()
    expect(rows.map((r: any) => r.archivo)).toEqual(esperadas)
  })

  it('no da por aplicada ninguna migración posterior al corte', async () => {
    // El caso que hace daño de verdad. `20260812_sin_default_tenant.sql` está
    // escrita y NO aplicada en producción (F1.2 → F1.5). Si el backfill la
    // marcara como hecha, el runner no la aplicaría nunca y el DEFAULT de
    // tenant_id —la deriva que etiqueta filas ajenas como RGB— seguiría vivo en
    // el droplet, con el registro jurando lo contrario.
    const { rows } = await poolTest().query(
      "select archivo from schema_migrations where archivo >= '20260812'",
    )
    expect(rows).toEqual([])
  })

  it('tampoco da por aplicada una migración de DATOS', async () => {
    // `deploy.yml:141-148` NUNCA las aplica en un despliegue normal: hay que
    // pedirlas a mano. Así que de una migración `@tipo: datos` no se puede
    // afirmar que corrió, y el registro solo debe contener hechos.
    const { rows } = await poolTest().query(
      "select archivo from schema_migrations where archivo = '20260731_calendario_meses_cortos.sql'",
    )
    expect(rows).toEqual([])
  })

  it('aplicarla dos veces no cambia el número de filas', async () => {
    // `recrearEsquema()` ya la aplicó una vez; estas son la segunda y la
    // tercera. Una migración que solo funciona sobre esquema virgen es una bomba
    // para el runner de la flota.
    const antes = await poolTest().query('select count(*)::int as n from schema_migrations')
    await poolTest().query(SQL())
    await poolTest().query(SQL())
    const despues = await poolTest().query('select count(*)::int as n from schema_migrations')
    expect(despues.rows[0].n).toBe(antes.rows[0].n)
  })

  it('una base VACÍA queda con la tabla vacía, lista para aplicarlas todas', async () => {
    // Una instancia nueva no tiene historia que respetar: el runner debe
    // aplicárselas de verdad. Se comprueba contra una base recién creada, sin
    // `schema.sql` siquiera — que es el estado en el que nace un droplet.
    const admin = poolTest()
    if (!BASE_VIRGEN.endsWith('_e2e')) throw new Error('la base desechable debe acabar en _e2e')
    await admin.query(`drop database if exists ${BASE_VIRGEN} with (force)`)
    await admin.query(`create database ${BASE_VIRGEN}`)
    const pool = new Pool({ connectionString: urlDe(BASE_VIRGEN), max: 1 })
    try {
      await pool.query(SQL())
      const { rows } = await pool.query('select count(*)::int as n from schema_migrations')
      expect(rows[0].n).toBe(0)
    } finally {
      await pool.end()
      await admin.query(`drop database if exists ${BASE_VIRGEN} with (force)`)
    }
  }, 30_000)
})

// ============================================================================
//  El RUNNER (`scripts/migrar.mjs`) — F3.2.
// ----------------------------------------------------------------------------
//  Se ejecuta como PROCESO, no importando sus funciones: lo que va a correr en
//  el droplet es `node scripts/migrar.mjs` desde `update.sh` (F3.4), y lo que
//  hay que probar es eso — incluido su código de salida, que es lo único que
//  mira un `set -e`.
//
//  Ojo con la base de prueba: se crea y se destruye una desechable acabada en
//  `_e2e`. `spaces_e2e` no sirve para el caso de la instancia nueva porque
//  `recrearEsquema()` ya le aplicó TODO; y la `spaces` del 5433 tiene datos
//  reales.
// ============================================================================

const RAIZ = join(process.cwd(), '..', '..')
const BASE_RUNNER = 'spaces_runner_e2e'

// El mismo prólogo que `recrearEsquema()` (`db-e2e.ts:120-133`), y por el mismo
// motivo: el rol de la app va PRIMERO. `20260729_licencias_permisos.sql:96-97`
// aborta con `raise exception` si no encuentra ningún rol de aplicación con
// grants, y son 13 las migraciones que dependen de ese rol. O sea que el runner
// NO es autosuficiente contra una base recién creada: la secuencia real de una
// instancia es rol de app → `schema.sql` → migraciones, y de las dos primeras
// hoy no se encarga nadie (`Dockerfile:94-95` ni siquiera mete `dev-rol-app.sql`
// en la imagen). Aquí se reproduce ese prólogo tal cual para poder probar la
// tercera parte, que es la que esta tarea construye.
async function prepararBaseVacia(pool: Pool) {
  const raizDb = join(RAIZ, 'db')
  await pool.query(readFileSync(join(raizDb, 'dev-rol-app.sql'), 'utf8'))
  await pool.query(readFileSync(join(raizDb, 'schema.sql'), 'utf8'))
}

function correrRunner(base: string | null, args: string[] = []) {
  const env: NodeJS.ProcessEnv = { ...process.env }
  if (base) env.DATABASE_URL = urlDe(base)
  else delete env.DATABASE_URL
  return spawnSync(process.execPath, [join('scripts', 'migrar.mjs'), ...args], {
    cwd: RAIZ,
    env,
    encoding: 'utf8',
  })
}

// Las de ESQUEMA del directorio, calculadas aquí a mano y no con la función del
// runner: si la expectativa saliera del propio código que se prueba, la prueba
// no diría nada. El marcador se busca en la PRIMERA línea, que es donde está de
// verdad (`20260731_calendario_meses_cortos.sql:1`).
function migracionesDeEsquema(): string[] {
  return readdirSync(DIR_MIGRACIONES)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => {
      const primera = readFileSync(join(DIR_MIGRACIONES, f), 'utf8').split('\n')[0]
      return !/^--\s*@tipo:\s*datos/i.test(primera)
    })
    .sort()
}

const COLUMNAS = `select table_name, column_name, data_type, is_nullable, column_default
                    from information_schema.columns
                   where table_schema = 'public'
                   order by table_name, column_name`

describe('runner de migraciones', () => {
  let pool: Pool
  let pendientesAntes: ReturnType<typeof correrRunner>
  let primera: ReturnType<typeof correrRunner>
  // Se mide JUSTO después de `--pendientes` y antes de aplicar nada: después ya
  // no probaría lo que dice, porque la tabla la crea la propia migración.
  let registroTrasListar: boolean

  beforeAll(async () => {
    const admin = poolTest()
    if (!BASE_RUNNER.endsWith('_e2e')) throw new Error('la base desechable debe acabar en _e2e')
    await admin.query(`drop database if exists ${BASE_RUNNER} with (force)`)
    await admin.query(`create database ${BASE_RUNNER}`)
    pool = new Pool({ connectionString: urlDe(BASE_RUNNER), max: 2 })
    await prepararBaseVacia(pool)
    // `--instalacion-nueva` no es un adorno: `schema.sql` siembra el tenant
    // 'rgb' (`db/schema.sql:598`), así que a partir de ese punto la base ya
    // cumple la heurística de «base con historia» del backfill y es
    // INDISTINGUIBLE de un droplet rezagado. El runner se niega a adivinar; aquí
    // se le dice cuál de los dos casos es, que es justo lo que sabe el
    // aprovisionamiento y no sabe el script.
    pendientesAntes = correrRunner(BASE_RUNNER, ['--pendientes', '--instalacion-nueva'])
    registroTrasListar = (
      await pool.query("select to_regclass('public.schema_migrations') is not null as hay")
    ).rows[0].hay
    primera = correrRunner(BASE_RUNNER, ['--instalacion-nueva'])
  }, 120_000)

  afterAll(async () => {
    if (pool) await pool.end()
    await poolTest().query(`drop database if exists ${BASE_RUNNER} with (force)`)
  })

  it('sin DATABASE_URL aborta y no adivina la base', () => {
    // Desviación consciente de `apply-migration.mjs:16-24`, que cae en un
    // default local. Ese default es `…@localhost:5433/spaces`: la base de
    // desarrollo con DATOS REALES, cuyo rol `spaces` es superusuario con
    // BYPASSRLS. Es lo mismo que T-02 le quitó a `bootstrap-auth.mjs`
    // (`apps/web/scripts/bootstrap-auth.mjs:10-22`), y aquí pesa más: un runner
    // de migraciones escribe DDL, no una fila.
    const r = correrRunner(null)
    expect(r.status).not.toBe(0)
    expect(r.stderr).toMatch(/DATABASE_URL/)
  })

  it('--pendientes lista sin aplicar y sin crear nada', () => {
    expect(pendientesAntes.status).toBe(0)
    expect(pendientesAntes.stdout).toContain('20260625_agencia_en_propuesta.sql')
    expect(pendientesAntes.stdout).toContain('20260731_calendario_meses_cortos.sql')
    // Y lo que importa: no dejó rastro. Si `--pendientes` creara la tabla de
    // registro, ya no sería una consulta.
    expect(registroTrasListar).toBe(false)
  })

  it('el destino se registra SIN credenciales', () => {
    expect(pendientesAntes.stdout).toContain(`/${BASE_RUNNER}`)
    expect(pendientesAntes.stdout).not.toContain('spaces:spaces')
  })

  it('contra una base vacía aplica todas y deja el esquema de recrearEsquema()', async () => {
    expect(primera.stderr).toBe('')
    expect(primera.status).toBe(0)

    const registradas = await pool.query('select archivo from schema_migrations order by archivo')
    expect(registradas.rows.map((r: any) => r.archivo)).toEqual(migracionesDeEsquema())
    expect(registradas.rows.length).toBeGreaterThanOrEqual(66)

    // Ni una fila de 'backfill', y NO porque el backfill no se dispare —se
    // dispara: el prólogo corre `schema.sql`, que siembra el tenant 'rgb'
    // (`db/schema.sql:598`), así que al llegarle el turno a
    // `20260812_schema_migrations.sql` sus 65 filas nacen. Lo que las sustituye
    // es el `on conflict … do update` del propio runner (`migrar.mjs:215-218`),
    // y aquí eso es lo correcto: esas 65 las acaba de aplicar ÉL en esta misma
    // pasada, con un contenido que conoce. Medido cambiando solo esa cláusula:
    // con `do update` salen 0; con `do nothing`, 65.
    const backfill = await pool.query(
      "select count(*)::int as n from schema_migrations where checksum = 'backfill'",
    )
    expect(backfill.rows[0].n).toBe(0)

    // Y el esquema resultante es el mismo que el del arnés, que es el que dan
    // por bueno las demás pruebas de integración. Lo que esto atrapa es que el
    // runner se salte un archivo o que deje la base distinta. Lo que NO atrapa
    // es un orden equivocado: los dos lados ordenan con la MISMA `ordenar()`
    // (`db-e2e.ts:145` y `migrar.mjs:107`), así que un orden malo saldría igual
    // de mal a los dos lados. Quien ancla el orden es la unitaria
    // `scripts/migrar.test.ts`.
    const arnes = await poolTest().query(COLUMNAS)
    const runner = await pool.query(COLUMNAS)
    expect(runner.rows).toEqual(arnes.rows)
  }, 60_000)

  it('la de DATOS queda fuera y se anuncia como pendiente', async () => {
    // Igual que `deploy.yml:141-148`: las de datos reescriben filas y no se
    // deshacen solas, así que se piden a mano. Pero no se ocultan.
    const { rows } = await pool.query(
      "select archivo from schema_migrations where archivo = '20260731_calendario_meses_cortos.sql'",
    )
    expect(rows).toEqual([])
    expect(primera.stdout).toContain('20260731_calendario_meses_cortos.sql')
  })

  it('correrlo dos veces no aplica nada la segunda y devuelve 0', async () => {
    const antes = await pool.query(
      'select count(*)::int as n, max(aplicada_en) as ultima from schema_migrations',
    )
    const segunda = correrRunner(BASE_RUNNER)
    expect(segunda.status).toBe(0)
    expect(segunda.stdout).toMatch(/0 aplicadas/)
    const despues = await pool.query(
      'select count(*)::int as n, max(aplicada_en) as ultima from schema_migrations',
    )
    // Ni una fila más, y sobre todo: ni una fila REESCRITA. Un runner que
    // refrescara `aplicada_en` en cada corrida borraría el único dato que dice
    // cuándo se puso al día una instancia.
    expect(despues.rows[0]).toEqual(antes.rows[0])
  }, 60_000)

  it('si aplica y NO puede registrar, sale 2 — no 1 con un volcado de pila', async () => {
    // El contrato de códigos de salida lo escribe el propio runner en su
    // cabecera (`migrar.mjs:15-19`) y es lo ÚNICO que mira el `set -e` del
    // `update.sh` de F3.4: el 2 significa «se aplicaron y no se pudieron
    // registrar», o sea «ve a mirar esa base a mano». Si el insert del registro
    // escapa sin capturar, Node sale 1 con un volcado de pila y el operador lee
    // «no se pudo ni empezar» sobre una base que SÍ cambió.
    //
    // El fallo se fabrica con un trigger que rechaza el insert: es la forma
    // barata de reproducir un registro que no acepta escrituras (permisos,
    // disco lleno, una réplica en solo lectura).
    await pool.query("delete from schema_migrations where archivo = '20260812_sin_default_tenant.sql'")
    await pool.query(`create or replace function rechazar_registro() returns trigger
                        language plpgsql as $$ begin raise exception 'registro no disponible'; end $$`)
    await pool.query(`create trigger rechazar_registro before insert on schema_migrations
                        for each row execute function rechazar_registro()`)
    try {
      const r = correrRunner(BASE_RUNNER)
      expect(r.status).toBe(2)
      // Y dice QUÉ quedó aplicado sin constar, que es el dato con el que se
      // repara a mano.
      expect(r.stderr).toContain('20260812_sin_default_tenant.sql')
      expect(r.stderr).not.toMatch(/^\s+at /m)
    } finally {
      await pool.query('drop trigger if exists rechazar_registro on schema_migrations')
      await pool.query('drop function if exists rechazar_registro()')
      correrRunner(BASE_RUNNER) // deja el registro completo para quien venga detrás
    }
  }, 60_000)
})

// ============================================================================
//  Una instancia REZAGADA — el caso que tumbaba al runner y no probaba nadie.
// ----------------------------------------------------------------------------
//  Es el droplet de hoy: historia aplicada a mano durante meses y NINGUNA tabla
//  de registro, porque `20260812_schema_migrations.sql` está escrita y sin
//  aplicar (`vault/04-Datos/migraciones.md`). Sobre esa base, «no hay registro»
//  no significa «instancia nueva»: significa exactamente lo contrario.
//
//  Y el runner NO puede distinguirlas, porque después de `schema.sql` las dos
//  tienen el tenant 'rgb' y ninguna tiene registro. Las dos salidas equivocadas
//  hacen daño por lados opuestos:
//
//    · tratar la rezagada como nueva → reaplica su historia entera. Una base
//      parada en la ventana [20260723, 20260807) aborta a mitad al hacerlo, y
//      queda con migraciones aplicadas y cero registradas.
//    · tratar la nueva como rezagada (aplicarle el backfill antes que nada) →
//      da por aplicadas 65 migraciones que NUNCA corrieron, y `schema.sql` es un
//      SUBCONJUNTO de lo desplegado —le faltan 143 columnas, medidas en
//      `db-e2e.ts:107-112`—, así que el esquema queda incompleto SIN dar error.
//
//  Por eso el runner se niega y pregunta, en vez de adivinar.
// ============================================================================

const BASE_REZAGADA = 'spaces_rezagada_e2e'
const MIGRACION_REGISTRO = '20260812_schema_migrations.sql'

// Reproduce el droplet: rol de app → `schema.sql` → toda la historia de esquema
// anterior al corte del 2026-08-12, aplicada «a mano» y sin registrar. Que sea
// justo el corte del backfill no es casualidad: es lo que la flota tenía el
// 2026-08-12 (`20260812_schema_migrations.sql:29-35`).
async function prepararInstanciaRezagada(pool: Pool): Promise<string[]> {
  await prepararBaseVacia(pool)
  const historicas = ordenar(migracionesDeEsquema()).filter((f: string) => f < '20260812')
  for (const archivo of historicas) {
    try {
      await pool.query(readFileSync(join(DIR_MIGRACIONES, archivo), 'utf8'))
    } catch (e) {
      throw new Error(`Montando la instancia rezagada falló ${archivo}: ${(e as Error).message}`)
    }
  }
  return historicas
}

describe('runner contra una instancia rezagada', () => {
  let pool: Pool
  let historicas: string[]
  let listado: ReturnType<typeof correrRunner>
  let aplicar: ReturnType<typeof correrRunner>

  beforeAll(async () => {
    const admin = poolTest()
    if (!BASE_REZAGADA.endsWith('_e2e')) throw new Error('la base desechable debe acabar en _e2e')
    await admin.query(`drop database if exists ${BASE_REZAGADA} with (force)`)
    await admin.query(`create database ${BASE_REZAGADA}`)
    pool = new Pool({ connectionString: urlDe(BASE_REZAGADA), max: 2 })
    historicas = await prepararInstanciaRezagada(pool)
    listado = correrRunner(BASE_REZAGADA, ['--pendientes'])
    aplicar = correrRunner(BASE_REZAGADA)
  }, 180_000)

  afterAll(async () => {
    if (pool) await pool.end()
    await poolTest().query(`drop database if exists ${BASE_REZAGADA} with (force)`)
  })

  it('se niega a aplicar y dice qué hacer, en vez de suponer que es nueva', () => {
    expect(aplicar.status).not.toBe(0)
    // El mensaje tiene que nombrar la migración que hay que aplicar primero: sin
    // eso, el operador solo sabe que algo falló.
    expect(aplicar.stderr).toContain(MIGRACION_REGISTRO)
  })

  it('y no toca la base: ni una migración reaplicada', async () => {
    // Dos testigos independientes. El registro sigue sin existir…
    const reg = await pool.query("select to_regclass('public.schema_migrations') is null as vacio")
    expect(reg.rows[0].vacio).toBe(true)
    // …y el `DEFAULT` de `tenant_id` sigue vivo, o sea que
    // `20260812_sin_default_tenant.sql` —la única pendiente de verdad— no corrió.
    const def = await pool.query(
      `select count(*)::int as n from information_schema.columns
        where table_schema = 'public' and column_name = 'tenant_id' and column_default is not null`,
    )
    expect(def.rows[0].n).toBeGreaterThan(0)
  })

  it('--pendientes tampoco miente: no dice «Aplicadas: 0» sobre una base con historia', () => {
    // Es la orden que se teclea JUSTO antes de actualizar, así que su respuesta
    // pesa más que la del propio `migrar`: contestaba «68 pendientes …
    // Aplicadas: 0» sobre una base que las tenía casi todas.
    expect(listado.status).not.toBe(0)
    expect(listado.stdout).not.toContain('Aplicadas: 0')
    expect(listado.stderr).toContain(MIGRACION_REGISTRO)
  })

  it('aplicado el registro, el runner aplica SOLO lo que falta', async () => {
    // El remedio que indica el propio mensaje de error, tecleado tal cual.
    await pool.query(readFileSync(join(DIR_MIGRACIONES, MIGRACION_REGISTRO), 'utf8'))
    const backfill = await pool.query(
      "select count(*)::int as n from schema_migrations where checksum = 'backfill'",
    )
    expect(backfill.rows[0].n).toBe(historicas.length)

    const faltan = migracionesDeEsquema().length - historicas.length
    const r = correrRunner(BASE_REZAGADA)
    expect(r.status).toBe(0)
    expect(r.stdout).toContain(`${faltan} aplicadas`)

    // Y las 65 históricas siguen marcadas como backfill: si el runner las
    // hubiera reaplicado, su `on conflict … do update` habría escrito checksums
    // reales encima. Esto es «aplica solo lo que le falta», comprobado por el
    // rastro que dejaría lo contrario.
    const despues = await pool.query(
      "select count(*)::int as n from schema_migrations where checksum = 'backfill'",
    )
    expect(despues.rows[0].n).toBe(historicas.length)

    const registradas = await pool.query('select archivo from schema_migrations order by archivo')
    expect(registradas.rows.map((x: any) => x.archivo)).toEqual(migracionesDeEsquema())

    // Y queda en el mismo esquema que el arnés: ponerse al día por este camino
    // llega al mismo sitio que aplicarlas todas desde cero.
    const arnes = await poolTest().query(COLUMNAS)
    const rezagada = await pool.query(COLUMNAS)
    expect(rezagada.rows).toEqual(arnes.rows)
  }, 60_000)
})
