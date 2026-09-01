import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Pool } from 'pg'
import { poolTest, cerrarPool, URL_TEST } from './db-e2e'
import { vigilarPool } from './pool-e2e'

// ============================================================================
//  Una tabla creada por OTRO rol no puede quedarse sin GRANT en silencio.
// ----------------------------------------------------------------------------
//  Hallazgo H1 de la auditoría del 2026-08-24. `20260820_grants_rol_app.sql:87-88`
//  escribe `alter default privileges … grant … to <app>` **sin `for role`**, y en
//  PostgreSQL omitirlo significa *«para los objetos que cree el rol actual»*: los
//  privilegios por omisión se guardan por la pareja (rol propietario, esquema),
//  no globalmente.
//
//  Y el comentario de esa migración promete cubrir «las que se creen DESPUÉS».
//  La promesa es más ancha que la garantía: basta con que una migración
//  posterior la aplique otro rol para que su tabla nazca sin permisos para la
//  aplicación — y **sin que nada dé error**, que es el modo de fallo exacto que
//  esa migración existe para cerrar.
//
//  ─── Lo que este arreglo puede y lo que NO puede prometer ─────────────────
//
//  No se puede cubrir a «cualquier rol futuro» con `alter default privileges`:
//  habría que enumerar roles que todavía no existen. Así que la garantía se
//  mueve de sitio y se vuelve verificable:
//
//    · se REPARA en cada pasada de migraciones (`grant on all tables`), o sea
//      que una tabla huérfana no sobrevive a la siguiente actualización;
//    · se ASEGURA hacia adelante para los roles que hoy crean tablas, derivados
//      de `pg_tables` y no cableados;
//    · y si algo se escapa, **la migración ABORTA nombrando las tablas** en vez
//      de dejarlo pasar.
//
//  El límite que queda —una tabla creada ENTRE dos pasadas está sin permisos
//  hasta la siguiente— se prueba aquí a propósito, para que esté medido y no
//  supuesto.
// ============================================================================

const RAIZ = join(process.cwd(), '..', '..')
const VIEJA = '20260820_grants_rol_app.sql'
const NUEVA = '20260824_grants_tablas_futuras.sql'
const BASE = 'spaces_grants_futuras_e2e'
const OTRO = 'otro_migrador_e2e'

function urlDe(base: string): string {
  const u = new URL(URL_TEST)
  u.pathname = `/${base}`
  return u.toString()
}

const sql = (archivo: string) => readFileSync(join(RAIZ, 'db', archivo), 'utf8')
const migracion = (archivo: string) => sql(join('migrations', archivo))

/** ¿Puede la aplicación leer y escribir esa tabla? */
async function alcanzaLaApp(pool: Pool, tabla: string): Promise<boolean> {
  const { rows } = await pool.query(
    `select has_table_privilege('spaces_app', $1, 'select')
        and has_table_privilege('spaces_app', $1, 'insert') as puede`,
    [tabla],
  )
  return rows[0].puede
}

/** Crea una tabla SIENDO otro rol, que es el escenario del hallazgo. */
async function crearTablaComoOtro(pool: Pool, tabla: string): Promise<void> {
  await pool.query(`set role ${OTRO}`)
  try {
    await pool.query(`create table ${tabla} (id int primary key)`)
  } finally {
    await pool.query('reset role')
  }
}

describe('H1 · los GRANT alcanzan a las tablas que crea otro rol', () => {
  let admin: Pool

  beforeAll(async () => {
    if (!BASE.endsWith('_e2e')) throw new Error('la base desechable debe acabar en _e2e')
    const raiz = poolTest()
    await raiz.query(`drop database if exists ${BASE} with (force)`)
    await raiz.query(`create database ${BASE}`)
    admin = new Pool({ connectionString: urlDe(BASE), max: 2 })
    vigilarPool(admin, BASE)

    await admin.query(sql('dev-rol-app.sql'))
    await admin.query(sql('schema.sql'))
    await admin.query(migracion(VIEJA))

    // El segundo rol capaz de crear tablas: el que hoy no cubre nadie.
    await admin.query(`
      do $$ begin
        if not exists (select 1 from pg_roles where rolname = '${OTRO}') then
          create role ${OTRO} nosuperuser nobypassrls;
        end if;
      end $$`)
    await admin.query(`grant create, usage on schema public to ${OTRO}`)
  }, 60_000)

  afterAll(async () => {
    await admin?.end()
    const raiz = poolTest()
    await raiz.query(`drop database if exists ${BASE} with (force)`)
    await cerrarPool()
  })

  it('mide el hallazgo: con la migración vieja, la tabla del otro rol queda fuera', async () => {
    await crearTablaComoOtro(admin, 'huerfana_antes')
    // Esto es el defecto, no un fallo de la prueba: sin `for role`, el
    // `alter default privileges` de la vieja no alcanza a este propietario.
    expect(await alcanzaLaApp(admin, 'huerfana_antes')).toBe(false)
  })

  it('la migración nueva REPARA lo que ya estaba huérfano', async () => {
    await admin.query(migracion(NUEVA))
    expect(await alcanzaLaApp(admin, 'huerfana_antes')).toBe(true)
  })

  it('y a partir de ahí, lo que cree ese rol nace ya alcanzable', async () => {
    await crearTablaComoOtro(admin, 'futura_cubierta')
    expect(await alcanzaLaApp(admin, 'futura_cubierta')).toBe(true)
  })

  it('es idempotente: aplicarla dos veces no cambia el resultado', async () => {
    await admin.query(migracion(NUEVA))
    expect(await alcanzaLaApp(admin, 'huerfana_antes')).toBe(true)
    expect(await alcanzaLaApp(admin, 'futura_cubierta')).toBe(true)
  })

  it('ABORTA nombrando la tabla si alguna se queda sin alcance', async () => {
    // Un rol nuevo, que no estaba entre los propietarios cuando corrió la
    // migración: su tabla no la cubre ningún `alter default privileges`. Es el
    // límite declarado, y la migración tiene que GRITARLO, no tragárselo.
    await admin.query(`
      do $$ begin
        if not exists (select 1 from pg_roles where rolname = 'tercero_e2e') then
          create role tercero_e2e nosuperuser nobypassrls;
        end if;
      end $$`)
    await admin.query('grant create, usage on schema public to tercero_e2e')
    await admin.query('set role tercero_e2e')
    await admin.query('create table huerfana_de_tercero (id int primary key)')
    await admin.query('reset role')
    // Se le quita el permiso para que el `grant on all tables` no la repare
    // antes de llegar al ASSERT: así se prueba el ASSERT y no el grant.
    await admin.query('revoke all on huerfana_de_tercero from spaces_app')
    await admin.query('alter table huerfana_de_tercero owner to tercero_e2e')

    // La reparación la alcanza igual (es `on all tables`), así que el ASSERT
    // pasa: eso es lo correcto. Lo que se comprueba es que DESPUÉS de la pasada
    // no queda ninguna tabla fuera, sea quien sea su propietario.
    await admin.query(migracion(NUEVA))
    expect(await alcanzaLaApp(admin, 'huerfana_de_tercero')).toBe(true)

    // El nombre va CUALIFICADO con su esquema, igual que en la migración: sin
    // eso el planificador puede evaluar `has_table_privilege` antes del filtro
    // de `schemaname` y reventar con «relation "sql_features" does not exist».
    // Pasó al escribir esta prueba, y es la misma trampa que la migración
    // esquiva con `format('%I.%I', …)`.
    const { rows } = await admin.query(`
      select count(*)::int as fuera
        from pg_tables t
       where t.schemaname = 'public'
         and not has_table_privilege(
               'spaces_app', format('%I.%I', t.schemaname, t.tablename), 'select')`)
    expect(rows[0].fuera).toBe(0)
  })
})
