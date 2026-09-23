import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { Pool } from 'pg'
import { URL_TEST } from './db-e2e'
import { vigilarPool } from './pool-e2e'

// ============================================================================
//  El guard de version minima de PostgreSQL — `-- @pg-min: N`.
// ----------------------------------------------------------------------------
//  Lo que motiva este archivo, medido el 2026-09-23 en `g500` (la unica
//  instancia con datos reales de cliente). Al subirla de `v0.5.1` a `v0.7.0`:
//
//      == 20260917_costos_ot_por_tipo.sql
//      == 20260917_entidades_fiscales.sql
//      == 20260918_consumos_energia.sql
//      == 20260918_entidad_tenant_compuesto.sql
//      ERROR migrar: fallo la migracion 20260918_entidad_tenant_compuesto.sql:
//                    syntax error at or near "("
//        3 aplicadas antes del fallo. Abortado sin registrar esta.
//      ABORTADO (2): LA BASE CAMBIO.
//
//  `g500` corre PostgreSQL 14.24 y esa migracion usa `on delete set null
//  (entidad_id)` (`:138` y `:170`), que es PostgreSQL 15+. El PADRE y DEMO
//  corren 16.15, asi que la migracion paso por todas las pruebas y por DEMO sin
//  una sola senal.
//
//  Lo que estas pruebas defienden NO es que el runner falle —ya fallaba— sino
//  CUANDO falla: antes de aplicar la primera, y no despues de la tercera. La
//  diferencia entre las dos es una base a medio migrar sobre datos reales.
//
//  ── Como se produce el caso sin un PostgreSQL 14 ──────────────────────────
//  No se simula la version del servidor: se sube la EXIGENCIA. Una migracion de
//  prueba que declara `-- @pg-min: 99` bloquea contra cualquier motor que exista
//  hoy, asi que el guard se ejercita contra el Postgres real del arnes (16.x) y
//  el resultado no depende de ningun doble. A cambio, lo que estas pruebas NO
//  demuestran es que la sintaxis concreta del 18/09 falle en un 14 de verdad:
//  eso esta medido en g500, no aqui.
// ============================================================================

const RAIZ = join(process.cwd(), '..', '..')
const DIR_MIGRACIONES = join(RAIZ, 'db', 'migrations')
const BASE = 'spaces_pgmin_e2e'

// Las dos migraciones de prueba van con prefijo del ano 2999 para que el orden
// (lexicografico = cronologico) las ponga AL FINAL, detras de toda la historia
// real. La inofensiva va ANTES que la exigente a proposito: es la que demuestra
// que no se aplica «ni siquiera la que si podria».
const INOFENSIVA = '29991230_canario_inofensiva.sql'
const EXIGENTE = '29991231_canario_exige_pg_del_futuro.sql'
const TABLA_INOFENSIVA = 'canario_pg_min_inofensiva'
const TABLA_EXIGENTE = 'canario_pg_min_exigente'

const SQL_INOFENSIVA = `create table if not exists ${TABLA_INOFENSIVA} (a int);\n`
const sqlExigente = (pgMin: number) =>
  `-- @pg-min: ${pgMin}\ncreate table if not exists ${TABLA_EXIGENTE} (a int);\n`

function urlDe(base: string): string {
  const u = new URL(URL_TEST)
  u.pathname = `/${base}`
  return u.toString()
}

// Como `migraciones.e2e.test.ts:283`: se ejecuta el runner COMO PROCESO, no
// importando sus funciones. Lo que corre en una instancia es
// `node scripts/migrar.mjs` desde `update.sh`, y lo unico que mira su `set -e`
// es el codigo de salida.
function correrRunner(args: string[] = []) {
  return spawnSync(process.execPath, [join('scripts', 'migrar.mjs'), ...args], {
    cwd: RAIZ,
    env: { ...process.env, DATABASE_URL: urlDe(BASE) },
    encoding: 'utf8',
  })
}

function escribirMigracion(archivo: string, contenido: string) {
  writeFileSync(join(DIR_MIGRACIONES, archivo), contenido)
}

function borrarMigracion(archivo: string) {
  const ruta = join(DIR_MIGRACIONES, archivo)
  if (existsSync(ruta)) unlinkSync(ruta)
}

async function existeTabla(pool: Pool, tabla: string): Promise<boolean> {
  const { rows } = await pool.query("select to_regclass('public.' || $1) is not null as hay", [
    tabla,
  ])
  return rows[0].hay
}

async function registradas(pool: Pool): Promise<string[]> {
  const { rows } = await pool.query('select archivo from schema_migrations order by archivo')
  return rows.map((r) => r.archivo)
}

describe('guard de version minima de PostgreSQL', () => {
  let admin: Pool
  let pool: Pool
  let version: number
  // Resultados capturados en el beforeAll: cada corrida del runner cuesta, y
  // las expectativas de varios `it` miran la misma.
  let bloqueada: ReturnType<typeof correrRunner>
  let listadoBloqueado: ReturnType<typeof correrRunner>
  let tablaInofensivaTrasBloqueo = true
  let tablaExigenteTrasBloqueo = true
  let registradasTrasBloqueo: string[] = []

  beforeAll(async () => {
    if (!BASE.endsWith('_e2e')) throw new Error('la base desechable debe acabar en _e2e')
    admin = new Pool({ connectionString: urlDe('postgres'), max: 2 })
    await admin.query(`drop database if exists ${BASE} with (force)`)
    await admin.query(`create database ${BASE}`)
    pool = new Pool({ connectionString: urlDe(BASE), max: 2 })
    vigilarPool(pool, BASE)

    // El prologo real de una instancia: rol de app -> schema.sql -> migraciones
    // (`migraciones.e2e.test.ts:277-281`). Sin el rol, trece migraciones no
    // conceden nada y una aborta.
    const raizDb = join(RAIZ, 'db')
    await pool.query(readFileSync(join(raizDb, 'dev-rol-app.sql'), 'utf8'))
    await pool.query(readFileSync(join(raizDb, 'schema.sql'), 'utf8'))

    // Se deja al dia ANTES de meter las migraciones de prueba: el escenario que
    // se quiere es el de g500 —una instancia viva que recibe una version
    // nueva—, no el de una instalacion desde cero.
    const alDia = correrRunner(['--instalacion-nueva'])
    if (alDia.status !== 0) {
      throw new Error(`el arnes no pudo dejar ${BASE} al dia: ${alDia.stderr}`)
    }

    version = Number(
      (await pool.query("select current_setting('server_version_num') as n")).rows[0].n,
    )

    escribirMigracion(INOFENSIVA, SQL_INOFENSIVA)
    escribirMigracion(EXIGENTE, sqlExigente(99))
    bloqueada = correrRunner()
    tablaInofensivaTrasBloqueo = await existeTabla(pool, TABLA_INOFENSIVA)
    tablaExigenteTrasBloqueo = await existeTabla(pool, TABLA_EXIGENTE)
    registradasTrasBloqueo = await registradas(pool)
    listadoBloqueado = correrRunner(['--pendientes'])
  }, 180_000)

  afterAll(async () => {
    // Son archivos del REPOSITORIO, no del arnes: se borran pase lo que pase.
    // Si se quedaran, `git status` saldria sucio y —peor— la siguiente corrida
    // de `npm test` veria dos migraciones que nadie escribio.
    borrarMigracion(INOFENSIVA)
    borrarMigracion(EXIGENTE)
    if (pool) await pool.end()
    if (admin) {
      await admin.query(`drop database if exists ${BASE} with (force)`).catch(() => {})
      await admin.end()
    }
  })

  it('el arnes corre un PostgreSQL que NO es el problema (15 o mas)', () => {
    // Si el motor del arnes fuera un 14, la prueba de «version suficiente» de
    // mas abajo estaria midiendo otra cosa sin decirlo.
    expect(Math.floor(version / 10000)).toBeGreaterThanOrEqual(15)
  })

  it('con una migracion que exige mas version, NO se aplica NINGUNA', async () => {
    // El corazon de todo esto. `29991230` no exige nada y se aplicaria sin
    // problema; el guard tambien la para. Aplicar lo que se puede y morir en lo
    // que no es exactamente lo que dejo a g500 a medio migrar.
    expect(bloqueada.status).toBe(4)
    expect(tablaInofensivaTrasBloqueo).toBe(false)
    expect(tablaExigenteTrasBloqueo).toBe(false)
    expect(registradasTrasBloqueo).not.toContain(INOFENSIVA)
    expect(registradasTrasBloqueo).not.toContain(EXIGENTE)
    // Y ni siquiera lo intento: el runner imprime `== <archivo>` justo antes de
    // ejecutarlo.
    expect(bloqueada.stdout).not.toContain(`== ${INOFENSIVA}`)
    expect(bloqueada.stdout).not.toContain(`== ${EXIGENTE}`)
  })

  it('el mensaje nombra la migracion, lo que pide y lo que hay', () => {
    // El liston es el mensaje que salio en g500: `syntax error at or near "("`.
    // Ese no dice que migracion, ni que version pide, ni cual hay, ni si la base
    // quedo tocada. Este tiene que decir las cuatro cosas.
    expect(bloqueada.stderr).toContain(EXIGENTE)
    expect(bloqueada.stderr).toContain('PostgreSQL 99')
    expect(bloqueada.stderr).toContain(`${Math.floor(version / 10000)}.${version % 10000}`)
    expect(bloqueada.stderr).toMatch(/ninguna/i)
    // Y no filtra la URL con su contrasena dentro (criterio M2).
    expect(bloqueada.stderr).not.toMatch(/postgresql:\/\//)
  })

  it('`--pendientes` tambien se niega: es el comando que se teclea justo antes', () => {
    // Mismo criterio que el guard de integridad de checksums, que ya corre antes
    // de `--pendientes` a proposito (`migrar.mjs:619-622`): si la actualizacion
    // no va a poder correr, el sitio donde hay que enterarse es el listado
    // previo, no a mitad del despliegue.
    expect(listadoBloqueado.status).toBe(4)
    expect(listadoBloqueado.stderr).toContain(EXIGENTE)
  })

  it('con version SUFICIENTE todo sigue exactamente como hoy', async () => {
    // La prueba que protege a las maquinas que YA funcionan. Se baja la
    // exigencia a una version que este motor cumple y el runner tiene que
    // comportarse como se comportaba antes de que el guard existiera: aplica las
    // dos, las registra y sale 0.
    escribirMigracion(EXIGENTE, sqlExigente(9))
    const r = correrRunner()
    expect(r.status).toBe(0)
    expect(await existeTabla(pool, TABLA_INOFENSIVA)).toBe(true)
    expect(await existeTabla(pool, TABLA_EXIGENTE)).toBe(true)
    const despues = await registradas(pool)
    expect(despues).toContain(INOFENSIVA)
    expect(despues).toContain(EXIGENTE)
  }, 120_000)

  it('una migracion SIN anotacion se comporta como siempre', async () => {
    // 87 de las 88 migraciones del repositorio no llevan anotacion. Que la
    // ausencia signifique «no exige nada» no es un detalle de implementacion:
    // si significara «exige lo ultimo», este guard pararia la flota entera.
    borrarMigracion(EXIGENTE)
    await pool.query(`drop table if exists ${TABLA_INOFENSIVA}`)
    await pool.query('delete from schema_migrations where archivo = $1', [INOFENSIVA])
    await pool.query('delete from schema_migrations where archivo = $1', [EXIGENTE])
    const r = correrRunner()
    expect(r.status).toBe(0)
    expect(await existeTabla(pool, TABLA_INOFENSIVA)).toBe(true)
  }, 120_000)
})
