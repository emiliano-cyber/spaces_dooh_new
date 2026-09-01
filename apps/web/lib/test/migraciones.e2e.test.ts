import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { Pool } from 'pg'
import { recrearEsquema, poolTest, cerrarPool, URL_TEST } from './db-e2e'
import { vigilarPool } from './pool-e2e'
// Solo para MONTAR el escenario de la instancia rezagada: aplicar su historia
// en el orden real. Las expectativas de estas pruebas nunca salen de aquí.
import {
  ordenar,
  revisarRolDeAplicacion,
  ROLES_APLICACION,
} from '../../../../scripts/migrar.mjs'

// ============================================================================
//  `schema_migrations` — cada instancia sabe qué migraciones ya corrió.
// ----------------------------------------------------------------------------
//  El mundo que motivó este runner: NO había tabla de control. El despliegue
//  reaplicaba TODAS las migraciones en cada corrida y confiaba en que fueran
//  idempotentes. Funcionaba con una sola instancia y una persona mirando; con
//  una flota, no saber en qué versión de esquema está cada droplet es el
//  problema.
//
//  Eso lo hacía `.github/workflows/deploy.yml:141-148`, **retirado el 2026-08-31
//  (F3.6)**. Hoy manda `scripts/migrar.mjs`, que lleva registro en
//  `schema_migrations` y aplica cada archivo UNA vez.
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
// de verdad: `spaces_e2e` la deja poblada `recrearEsquema()` (aplica
// `db/semilla-desarrollo.sql` entre el esquema y las migraciones), así que ahí
// el backfill SIEMPRE dispara y el caso de la base virgen no se podría
// distinguir. El nombre acaba en `_e2e` a propósito:
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
    // `recrearEsquema()` deja la base como el droplet: `schema.sql`, la
    // organización de desarrollo (`db/semilla-desarrollo.sql`, aplicada ANTES de
    // migrar a propósito) y todas las migraciones. Ahí el backfill debe haber
    // disparado.
    // `collate "C"` NO es adorno: sin el, `order by` usa la collation de la
    // BASE, y la expectativa de abajo sale de un `.sort()` de JavaScript, que
    // ordena por codigo de caracter. Los dos coinciden en el Postgres local
    // (`postgres:16-alpine`, musl -> collation C) y NO coinciden en el del CI
    // (`postgres:16` de Debian, glibc `en_US.utf8`), donde la puntuacion es
    // ignorable en el nivel primario y el `_` deja de contar.
    //
    // Medido el 2026-08-31 contra un postgres:16 de Debian (datcollate
    // en_US.utf8) con las 74 migraciones de esquema dentro: cambian de sitio
    // CUATRO, y son el grupo `20260727_contrato_incompleto*` --
    // `contrato_incompleto.sql` cae de la posicion 41 a la 44, porque ignorando
    // el `_` "cancelable" pasa por delante de "sql". Mismos 74 elementos en
    // distinto orden: `toEqual` rojo con dos arrays de 74.
    //
    // Y `collate "C"` devuelve EXACTAMENTE el orden del `.sort()` de
    // JavaScript, 74 de 74. Eso es lo que hace valida esta consulta.
    const { rows } = await poolTest().query(
      'select archivo, checksum, tipo from schema_migrations order by archivo collate "C"',
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
    // `scripts/migrar.mjs` NUNCA las aplica en un despliegue normal: hay que
    // pedirlas a mano con `--con-datos`. Antes lo hacía igual `deploy.yml`,
    // retirado el 31/08. Así que de una migración `@tipo: datos` no se puede
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
    vigilarPool(pool, BASE_VIRGEN)
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
    vigilarPool(pool, BASE_RUNNER)
    await prepararBaseVacia(pool)
    // `--instalacion-nueva` se pasa a conciencia aunque desde el 19/08 esta
    // base ya no la necesite: `schema.sql` dejó de sembrar organización, así
    // que aquí `tenants` está vacía y el guard de «no sé si eres nueva o
    // rezagada» no salta. La bandera se queda porque es lo que va a escribir el
    // aprovisionamiento —afirmar el caso en vez de confiar en una heurística— y
    // porque así se ejercita su verificación, que es lo que desmiente a quien
    // afirma en falso (el caso de abajo, sobre la base rezagada).
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

  it('sobre una base recién creada la bandera se VERIFICA y pasa', () => {
    // El camino legítimo, que es la razón de existir de la bandera: aquí la
    // base es rol de app + `schema.sql` y nada más, así que ninguna de las
    // tablas testigo existe y la afirmación se sostiene. La verificación se
    // dice en voz alta para que quede en el log del aprovisionamiento.
    expect(pendientesAntes.stdout).toMatch(/instalacion-nueva.*verificad/i)
    expect(pendientesAntes.status).toBe(0)
  })

  it('el destino se registra SIN credenciales', () => {
    expect(pendientesAntes.stdout).toContain(`/${BASE_RUNNER}`)
    expect(pendientesAntes.stdout).not.toContain('spaces:spaces')
  })

  it('contra una base vacía aplica todas y deja el esquema de recrearEsquema()', async () => {
    expect(primera.stderr).toBe('')
    expect(primera.status).toBe(0)

    // `collate "C"` por lo mismo que arriba: la expectativa es un `.sort()` de
    // JavaScript y el `order by` seguiria la collation de la base.
    const registradas = await pool.query('select archivo from schema_migrations order by archivo collate "C"')
    expect(registradas.rows.map((r: any) => r.archivo)).toEqual(migracionesDeEsquema())
    expect(registradas.rows.length).toBeGreaterThanOrEqual(66)

    // Ni una fila de 'backfill'. Desde el 19/08 hay DOS motivos, y los dos
    // apuntan al mismo sitio: el prólogo ya no siembra organización —`schema
    // .sql` dejó de traer el tenant 'rgb'—, así que al llegarle el turno a
    // `20260812_schema_migrations.sql` su backfill ni siquiera dispara («base
    // con esquema pero sin organizaciones: no hay historia que respetar»); y
    // aunque disparara, el `on conflict … do update` del propio runner
    // (`migrar.mjs:631-632`) las sustituiría por el checksum real, que aquí es
    // lo correcto: esas 65 las acaba de aplicar ÉL en esta misma pasada. Medido
    // en su día cambiando solo esa cláusula: con `do update` salen 0; con `do
    // nothing`, 65.
    const backfill = await pool.query(
      "select count(*)::int as n from schema_migrations where checksum = 'backfill'",
    )
    expect(backfill.rows[0].n).toBe(0)

    // Y el esquema resultante es el mismo que el del arnés, que es el que dan
    // por bueno las demás pruebas de integración. Lo que esto atrapa es que el
    // runner se salte un archivo o que deje la base distinta. Lo que NO atrapa
    // es un orden equivocado: los dos lados ordenan con la MISMA `ordenar()`
    // (definida en `migrar.mjs:76`; la llaman `migrar.mjs:236` y
    // `db-e2e.ts:165`), así que un orden malo saldría igual
    // de mal a los dos lados. Quien ancla el orden es la unitaria
    // `scripts/migrar.test.ts`.
    const arnes = await poolTest().query(COLUMNAS)
    const runner = await pool.query(COLUMNAS)
    expect(runner.rows).toEqual(arnes.rows)
  }, 60_000)

  it('la de DATOS queda fuera y se anuncia como pendiente', async () => {
    // Igual que `scripts/migrar.mjs`: las de datos reescriben filas y no se
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
    // cabecera (`migrar.mjs:21-32`) y es lo ÚNICO que mira el `set -e` del
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
//  La heurística con la que el runner mira esto es la del backfill: existe
//  `tenants` y tiene filas. Por eso esta base se siembra a mano una organización
//  —un droplet con meses de historia tiene organizaciones, y desde el 19/08
//  `schema.sql` ya no las regala—. Las dos salidas equivocadas hacen daño por
//  lados opuestos:
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
//
//  Otra señal SÍ las separa, y es la que verifica `--instalacion-nueva`: las
//  tablas que crean las migraciones y `schema.sql` no (`testigosDeHistoria()`).
//  No decide sola —la pregunta explícita se queda, porque decidir solo por una
//  señal es volver a la heurística— pero desmiente a quien afirma en falso.
// ============================================================================

const BASE_REZAGADA = 'spaces_rezagada_e2e'
const MIGRACION_REGISTRO = '20260812_schema_migrations.sql'

// Reproduce el droplet: rol de app → `schema.sql` → toda la historia de esquema
// anterior al corte del 2026-08-12, aplicada «a mano» y sin registrar. Que sea
// justo el corte del backfill no es casualidad: es lo que la flota tenía el
// 2026-08-12 (`20260812_schema_migrations.sql:29-35`).
async function prepararInstanciaRezagada(pool: Pool): Promise<string[]> {
  await prepararBaseVacia(pool)
  // La organización se siembra AQUÍ desde el 19/08, y no es un detalle del
  // montaje: es lo que distingue a esta base de una recién nacida. Antes la
  // ponía `schema.sql` gratis (sembraba 'rgb'), y al retirar ese seed —una
  // instancia no hereda la identidad de otro owner— la base rezagada se
  // quedaba SIN tenants, o sea indistinguible de una nueva para la heurística
  // del runner (`migrar.mjs:baseConHistoria`). Un droplet con meses de historia
  // tiene organizaciones; se dicen en voz alta.
  await pool.query(readFileSync(join(RAIZ, 'db', 'semilla-desarrollo.sql'), 'utf8'))
  // Y el DEFAULT de `tenant_id`, por lo mismo: el droplet lo TIENE —`schema.sql`
  // lo cableaba hasta el 19/08 y `20260812_sin_default_tenant.sql` sigue sin
  // aplicarse en producción—, así que una base rezagada sin él no sería una
  // base rezagada. Es además el segundo testigo de que el runner no tocó nada.
  await pool.query(`do $$
    declare t text; def uuid;
    begin
      select id into def from tenants where slug = 'rgb';
      foreach t in array array['usuarios','sitios','clientes','propuestas','propuesta_items',
        'ordenes_compra','campanas','creatividades','reservas','ordenes_trabajo','evidencias_ot',
        'ordenes_impresion','facturas','cobranzas','arrendadores','contratos_arrendamiento',
        'pagos_renta','incidencias','notificaciones','acciones','sitio_modalidades','predios',
        'arrendador_razon_social'] loop
        execute format('alter table %I alter column tenant_id set default %L', t, def);
      end loop;
    end $$`)
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
    vigilarPool(pool, BASE_REZAGADA)
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

  it('--instalacion-nueva NO se cree a ciegas: la base enseña historia y se niega', async () => {
    // El agujero que dejaba abierto el guard: la bandera AFIRMA un hecho y
    // nadie comprobaba que fuera verdad en la dirección que hace daño. El
    // mensaje de error del propio runner le pone al operador esta línea exacta
    // para copiar, así que tecleada sobre el droplet —que es una instancia
    // rezagada, no nueva— le reaplicaba su historia entera.
    //
    // La señal se DERIVA: tablas que crean las migraciones y que `schema.sql`
    // no crea. Una instalación recién nacida es rol de app + `schema.sql`, así
    // que ninguna puede existir en ella.
    const r = correrRunner(BASE_REZAGADA, ['--instalacion-nueva'])
    expect(r.status).toBe(1)

    // Los dos nombres van escritos a mano AQUÍ (el runner los deriva, no los
    // cablea): son el canario. El día que `almacen_activos` se renombre o
    // entre en `schema.sql`, esta prueba se pone roja en vez de perder
    // cobertura en silencio. Su gemela pura vive en `scripts/migrar.test.ts`.
    expect(r.stderr).toContain('almacen_activos')
    expect(r.stderr).toContain('20260723_almacen.sql')

    // Y no aplicó nada: dos testigos, los mismos que usa el caso de arriba.
    const reg = await pool.query("select to_regclass('public.schema_migrations') is null as vacio")
    expect(reg.rows[0].vacio).toBe(true)
    expect(r.stdout).not.toMatch(/aplicadas/)
  }, 60_000)

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

    // `collate "C"` por lo mismo que arriba: la expectativa es un `.sort()` de
    // JavaScript y el `order by` seguiria la collation de la base.
    const registradas = await pool.query('select archivo from schema_migrations order by archivo collate "C"')
    expect(registradas.rows.map((x: any) => x.archivo)).toEqual(migracionesDeEsquema())

    // Y queda en el mismo esquema que el arnés: ponerse al día por este camino
    // llega al mismo sitio que aplicarlas todas desde cero.
    const arnes = await poolTest().query(COLUMNAS)
    const rezagada = await pool.query(COLUMNAS)
    expect(rezagada.rows).toEqual(arnes.rows)
  }, 60_000)
})

// ============================================================================
//  Integridad: una migración YA APLICADA que cambia en disco — F3.3.
// ----------------------------------------------------------------------------
//  El registro guarda el sha256 de lo que se aplicó. Si el archivo que trae la
//  imagen ya no es ese, el registro y la imagen no cuentan la misma historia, y
//  todo lo que se aplique encima parte de una base que nadie sabe describir. La
//  instancia tiene que NEGARSE a actualizarse, y decir qué archivo.
//
//  Dos casos con signo opuesto, y el segundo es el que evita romper la flota:
//
//    · checksum REAL que ya no cuadra  → aborta (salida 3) sin aplicar nada;
//    · checksum `'backfill'`           → se salta la comprobación. Esas filas
//      son las que el droplet registró SIN checksum de origen, y
//      `20260812_schema_migrations.sql:51-56` declara que la marca existe justo
//      para esto. Importa hoy y no en abstracto: T-04 (`4c484fa`) editó dos
//      migraciones ya aplicadas —entre ellas la de abajo— para volver
//      reaplicable la cadena, así que su checksum en disco cambió de verdad.
//
//  Escenario: el droplet ya puesto al día. Las 65 históricas quedan como
//  'backfill' (las mete el backfill de la migración de registro) y las
//  posteriores al corte las aplica y registra el runner con su checksum real.
//  Así conviven en la misma base los dos tipos de fila.
// ============================================================================

const BASE_INTEGRIDAD = 'spaces_integridad_e2e'
// Registrada por el RUNNER, con checksum real: es de las posteriores al corte.
const CON_CHECKSUM_REAL = '20260812_sin_default_tenant.sql'
// Registrada por el BACKFILL, con la marca 'backfill'. Y es una de las dos que
// T-04 editó: el caso real, no uno inventado.
const CON_MARCA_BACKFILL = '20260720_hard1_usuarios_rls.sql'

// El sha256 se calcula AQUÍ, no importando `checksumDe()` del runner: si la
// expectativa saliera del propio código que se prueba, la prueba no diría nada.
function sha256De(archivo: string): string {
  return createHash('sha256')
    .update(readFileSync(join(DIR_MIGRACIONES, archivo), 'utf8'))
    .digest('hex')
}

// Reescribe el archivo en disco y devuelve cómo dejarlo como estaba. Un
// comentario al final basta: el plan dice en voz alta que «un cambio inocente de
// comentario aborta el update», y eso es exactamente lo que se quiere.
function alterarEnDisco(archivo: string): () => void {
  const ruta = join(DIR_MIGRACIONES, archivo)
  const original = readFileSync(ruta, 'utf8')
  writeFileSync(ruta, `${original}\n-- comentario anadido por la prueba de integridad (F3.3)\n`)
  return () => writeFileSync(ruta, original)
}

describe('integridad de lo ya aplicado', () => {
  let pool: Pool
  let puestaAlDia: ReturnType<typeof correrRunner>
  // Se restauran pase lo que pase: son archivos del repositorio, no del arnés.
  const restauradores: (() => void)[] = []

  beforeAll(async () => {
    const admin = poolTest()
    if (!BASE_INTEGRIDAD.endsWith('_e2e')) throw new Error('la base desechable debe acabar en _e2e')
    await admin.query(`drop database if exists ${BASE_INTEGRIDAD} with (force)`)
    await admin.query(`create database ${BASE_INTEGRIDAD}`)
    pool = new Pool({ connectionString: urlDe(BASE_INTEGRIDAD), max: 2 })
    vigilarPool(pool, BASE_INTEGRIDAD)
    await prepararInstanciaRezagada(pool)
    // El remedio que indica el propio runner: registro primero (backfill de las
    // 65 históricas), y después el runner aplica y registra lo que falta.
    await pool.query(readFileSync(join(DIR_MIGRACIONES, MIGRACION_REGISTRO), 'utf8'))
    puestaAlDia = correrRunner(BASE_INTEGRIDAD)
  }, 180_000)

  afterAll(async () => {
    for (const restaurar of restauradores.reverse()) restaurar()
    if (pool) await pool.end()
    await poolTest().query(`drop database if exists ${BASE_INTEGRIDAD} with (force)`)
  })

  it('el escenario tiene las dos clases de fila: con checksum real y con backfill', async () => {
    // Precondición explícita. Sin esto, cualquiera de los casos de abajo podría
    // pasar por el motivo equivocado —comparando contra una fila que no existe—
    // y nadie lo notaría.
    expect(puestaAlDia.status).toBe(0)
    const { rows } = await pool.query(
      'select archivo, checksum from schema_migrations where archivo = any($1)',
      [[CON_CHECKSUM_REAL, CON_MARCA_BACKFILL]],
    )
    const porArchivo = new Map(rows.map((r: any) => [r.archivo, r.checksum]))
    expect(porArchivo.get(CON_MARCA_BACKFILL)).toBe('backfill')
    expect(porArchivo.get(CON_CHECKSUM_REAL)).toBe(sha256De(CON_CHECKSUM_REAL))
  })

  it('si una migración ya aplicada cambia en disco, aborta con 3 y nombra los dos checksums', async () => {
    const registrado = sha256De(CON_CHECKSUM_REAL)
    const restaurar = alterarEnDisco(CON_CHECKSUM_REAL)
    restauradores.push(restaurar)
    try {
      const enDisco = sha256De(CON_CHECKSUM_REAL)
      expect(enDisco).not.toBe(registrado)

      const r = correrRunner(BASE_INTEGRIDAD)
      // El 3 es código propio: `update.sh` tiene que poder distinguir «historia
      // que no cuadra» de «una migración falló» (2) y de «no se pudo ni
      // empezar» (1).
      expect(r.status).toBe(3)
      expect(r.stderr).toContain(CON_CHECKSUM_REAL)
      // Los DOS checksums, que es lo que permite decidir cuál de los dos lados
      // está mal sin ir a mirar la base.
      expect(r.stderr).toContain(registrado)
      expect(r.stderr).toContain(enDisco)

      // Y no tocó nada: el registro sigue afirmando lo que afirmaba.
      const { rows } = await pool.query(
        'select checksum from schema_migrations where archivo = $1',
        [CON_CHECKSUM_REAL],
      )
      expect(rows[0].checksum).toBe(registrado)
    } finally {
      restaurar()
      restauradores.pop()
    }
  }, 60_000)

  it('y no aplica NADA más: la de datos pendiente se queda sin aplicar', async () => {
    // «Aborta» tiene que significar antes de aplicar, no a mitad. Con
    // `--con-datos` hay una migración pendiente de verdad
    // (`20260731_calendario_meses_cortos.sql`): si el guard corriera después del
    // bucle, esa quedaría aplicada y registrada.
    const restaurar = alterarEnDisco(CON_CHECKSUM_REAL)
    restauradores.push(restaurar)
    try {
      const r = correrRunner(BASE_INTEGRIDAD, ['--con-datos'])
      expect(r.status).toBe(3)
      const { rows } = await pool.query(
        "select archivo from schema_migrations where archivo = '20260731_calendario_meses_cortos.sql'",
      )
      expect(rows).toEqual([])
    } finally {
      restaurar()
      restauradores.pop()
    }
  }, 60_000)

  it('--pendientes tampoco calla: es la orden que se teclea justo antes', () => {
    // Mismo criterio que el guard de la instancia rezagada: `--pendientes` es la
    // consulta previa a actualizar. Si contestara la lista tan tranquila sobre
    // una base cuya historia no cuadra, el operador seguiría adelante.
    const restaurar = alterarEnDisco(CON_CHECKSUM_REAL)
    restauradores.push(restaurar)
    try {
      const r = correrRunner(BASE_INTEGRIDAD, ['--pendientes'])
      expect(r.status).toBe(3)
      expect(r.stderr).toContain(CON_CHECKSUM_REAL)
    } finally {
      restaurar()
      restauradores.pop()
    }
  }, 60_000)

  it('las filas de backfill se saltan la comprobación: T-04 no rompe la flota', async () => {
    // Sin esta excepción, el runner se negaría a actualizar TODAS las instancias
    // reales: sus 65 filas históricas se registraron sin checksum de origen y
    // T-04 editó dos de esos archivos. Comparar contra 'backfill' daría
    // divergencia siempre, y el remedio sería peor —inventar un checksum
    // afirmaría que lo aplicado coincide con lo que hoy hay en disco, que es
    // precisamente lo que no sabemos (`20260812_schema_migrations.sql:51-56`).
    const restaurar = alterarEnDisco(CON_MARCA_BACKFILL)
    restauradores.push(restaurar)
    try {
      const r = correrRunner(BASE_INTEGRIDAD)
      expect(r.status).toBe(0)
      expect(r.stderr).toBe('')
      // Y la fila sigue marcada: la comprobación no la «arregla» por el camino.
      const { rows } = await pool.query(
        'select checksum from schema_migrations where archivo = $1',
        [CON_MARCA_BACKFILL],
      )
      expect(rows[0].checksum).toBe('backfill')
    } finally {
      restaurar()
      restauradores.pop()
    }
  }, 60_000)

  it('--forzar-checksum=<archivo> deja pasar ESE archivo y pone al día su registro', async () => {
    const registrado = sha256De(CON_CHECKSUM_REAL)
    const restaurar = alterarEnDisco(CON_CHECKSUM_REAL)
    restauradores.push(restaurar)
    try {
      const enDisco = sha256De(CON_CHECKSUM_REAL)
      const r = correrRunner(BASE_INTEGRIDAD, [`--forzar-checksum=${CON_CHECKSUM_REAL}`])
      expect(r.status).toBe(0)
      // Que diga en voz alta qué se está saltando, y con qué se queda.
      expect(r.stdout).toContain(CON_CHECKSUM_REAL)
      expect(r.stdout).toContain(registrado)
      expect(r.stdout).toContain(enDisco)

      const { rows } = await pool.query(
        'select checksum from schema_migrations where archivo = $1',
        [CON_CHECKSUM_REAL],
      )
      expect(rows[0].checksum).toBe(enDisco)

      // Y el escape no se vuelve permanente: la siguiente corrida ya no necesita
      // la bandera. Una bandera que hay que dejar puesta para siempre en
      // `update.sh` es un agujero para siempre.
      const siguiente = correrRunner(BASE_INTEGRIDAD)
      expect(siguiente.status).toBe(0)
    } finally {
      restaurar()
      restauradores.pop()
      // El registro se deja como estaba: este caso es el único que lo reescribe,
      // y dejarlo apuntando al contenido alterado volvería rojos a los de abajo
      // por un motivo que nada tiene que ver con lo que prueban.
      await pool.query('update schema_migrations set checksum = $1 where archivo = $2', [
        registrado,
        CON_CHECKSUM_REAL,
      ])
    }
  }, 60_000)

  it('--forzar-checksum sobre un archivo que NO diverge se rechaza', () => {
    // Misma disciplina que `--instalacion-nueva`: la bandera afirma algo
    // concreto —«este archivo se reescribió a conciencia»— y el runner lo
    // comprueba antes de creérselo. Aquí lo que se atrapa es la bandera olvidada
    // en un script: si colara en silencio, seguiría desactivando la
    // comprobación de ese archivo el día que sí divergiera.
    const r = correrRunner(BASE_INTEGRIDAD, [`--forzar-checksum=${CON_CHECKSUM_REAL}`])
    expect(r.status).toBe(1)
    expect(r.stderr).toContain(CON_CHECKSUM_REAL)
  }, 60_000)

  it('--forzar-checksum sin nombre de archivo se rechaza: no perdona a bulto', () => {
    // Fail-closed. Una bandera suelta desactivaría la comprobación entera, que
    // es justo lo que F3.3 existe para impedir; nombrar el archivo obliga a
    // decidir sobre uno concreto.
    const restaurar = alterarEnDisco(CON_CHECKSUM_REAL)
    restauradores.push(restaurar)
    try {
      const r = correrRunner(BASE_INTEGRIDAD, ['--forzar-checksum'])
      expect(r.status).toBe(1)
      expect(r.stderr).toMatch(/--forzar-checksum=/)
    } finally {
      restaurar()
      restauradores.pop()
    }
  }, 60_000)
})


describe('el candado del rol de aplicacion', () => {
  // ── Por qué existe este candado ─────────────────────────────────────────
  //
  //  Los GRANT de la app no se conceden a quien sea: **13 migraciones** los dan
  //  a una lista blanca de dos nombres —`20260715_arr_m6_rol_restringido.sql:21`
  //  y `:38`, y el `foreach r in array array['spaces_user','spaces_app']` de
  //  otras once—, y todas van guardadas por existencia del rol. O sea que si el
  //  aprovisionamiento creara el rol de la instancia con CUALQUIER otro nombre,
  //  ninguna concedería nada y ninguna daría error: el runner registra la
  //  migración como aplicada y no vuelve a intentarlo nunca. La instancia
  //  arranca con un rol de aplicación que no puede leer ni una tabla, y eso se
  //  descubre en el primer login, lejos del alta que lo causó.
  //
  //  Medido el 2026-08-20; es el fondo común de ROJO-3, D5 y D6.

  let pool: Pool

  beforeAll(async () => {
    // El rol es del CLÚSTER, no de la base. `dev-rol-app.sql` es idempotente:
    // se aplica para que la prueba no dependa de qué suite corrió antes.
    pool = poolTest()
    await pool.query(readFileSync(join(process.cwd(), '..', '..', 'db', 'dev-rol-app.sql'), 'utf8'))
  }, 60_000)

  it('con el rol presente no estorba', async () => {
    expect(await revisarRolDeAplicacion(pool)).toBeNull()
  })

  it('si NINGUNO de los candidatos existe, devuelve un mensaje que los nombra', async () => {
    // Los nombres se pasan por parámetro solo aquí: `pg_roles` es del CLÚSTER,
    // así que producir la ausencia de verdad exigiría borrar el rol que usan
    // todas las demás suites. La consulta que se ejercita es la real.
    const mensaje = await revisarRolDeAplicacion(pool, ['rol_que_no_existe_e2e'])
    expect(mensaje).toBeTruthy()
    expect(mensaje).toContain('rol_que_no_existe_e2e')
    expect(mensaje).toMatch(/create role/i)
  })

  it('basta con que exista UNO de los candidatos', async () => {
    // Producción corre como `spaces_user` y no se le cambia el nombre. El
    // candado no puede exigir los dos: exige que haya rol de aplicación.
    expect(await revisarRolDeAplicacion(pool, ['rol_que_no_existe_e2e', 'spaces_app'])).toBeNull()
  })

  it('los candidatos son los que conceden las migraciones, y son DOS', () => {
    // La otra mitad del candado, y la que se rompe sola: si alguien cambiara la
    // lista, el runner exigiría un rol al que ninguna migración concede nada —
    // el mismo fallo, con otro disfraz. El umbral se mide, no se afloja: cada
    // uno de los dos nombres aparece en varias migraciones históricas.
    expect(ROLES_APLICACION).toEqual(['spaces_app', 'spaces_user'])
    const cuenta = (rol: string) =>
      readdirSync(DIR_MIGRACIONES)
        .filter((f) => f.endsWith('.sql') && f < '20260820')
        .filter((f) => readFileSync(join(DIR_MIGRACIONES, f), 'utf8').includes(rol)).length
    // Medido el 2026-08-20 contando archivo por archivo. Se afirman las dos
    // cifras exactas: un umbral flojo dejaría pasar que la lista se vacíe.
    expect(cuenta('spaces_app')).toBe(13)
    expect(cuenta('spaces_user')).toBe(13)
  })
})
