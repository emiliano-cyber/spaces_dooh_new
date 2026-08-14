import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { Pool } from 'pg'
import { recrearEsquema, poolTest, cerrarPool, URL_TEST } from './db-e2e'

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
