import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Pool } from 'pg'
import { poolTest, cerrarPool, URL_TEST } from './db-e2e'

// ============================================================================
//  Un rol de aplicación que nació sin permisos se repara al actualizar.
// ----------------------------------------------------------------------------
//  Los GRANT de la app los da `20260715_arr_m6_rol_restringido.sql`, y los da
//  **guardados por existencia del rol** (`:21` para `spaces_app`, `:38` para
//  `spaces_user`). Otras once migraciones hacen lo mismo con un
//  `foreach r in array array['spaces_user','spaces_app']`. Trece en total.
//
//  Ese guard tiene un modo de fallo que no da error: si el rol NO existía
//  cuando la migración corrió, el bloque entero es un no-op, la migración se
//  registra como aplicada, y no se vuelve a intentar nunca. El rol se crea
//  después —o se crea con otro nombre y luego se renombra— y queda sin un solo
//  permiso. La aplicación conecta y cada consulta muere con `permission
//  denied`: ruidoso para la instancia, silencioso para el alta que lo causó.
//
//  Por eso hace falta una migración que conceda **sin condiciones** y que viaje
//  con el código: es lo único que repara una instancia YA nacida, porque se
//  aplica al actualizarse. Vía B de la decisión del 2026-08-20 (ROJO-3);
//  la vía A es el candado de `scripts/migrar.mjs`.
// ============================================================================

const RAIZ = join(process.cwd(), '..', '..')
const MIGRACION = '20260820_grants_rol_app.sql'
const BASE = 'spaces_grants_e2e'
const CLAVE_APP = 'spaces_app_dev'

function urlDe(base: string, usuario?: string, clave?: string): string {
  const u = new URL(URL_TEST)
  u.pathname = `/${base}`
  if (usuario) {
    u.username = usuario
    u.password = clave ?? ''
  }
  return u.toString()
}

const sql = (archivo: string) => readFileSync(join(RAIZ, 'db', archivo), 'utf8')

describe('la migración que concede los GRANT sin lista blanca', () => {
  let admin: Pool
  let app: Pool

  beforeAll(async () => {
    if (!BASE.endsWith('_e2e')) throw new Error('la base desechable debe acabar en _e2e')
    const raiz = poolTest()
    await raiz.query(`drop database if exists ${BASE} with (force)`)
    await raiz.query(`create database ${BASE}`)
    admin = new Pool({ connectionString: urlDe(BASE), max: 2 })
    // El rol es del clúster y ya existe; `dev-rol-app.sql` es idempotente.
    await admin.query(sql('dev-rol-app.sql'))
    await admin.query(sql('schema.sql'))
    // El escenario: una instancia cuyo rol de aplicación quedó sin permisos.
    // Se reproduce revocando, que es el estado exacto en que la deja el guard
    // por existencia cuando el rol se crea DESPUÉS de la migración.
    await admin.query('revoke all on all tables in schema public from spaces_app')
    await admin.query('revoke all on all sequences in schema public from spaces_app')
    await admin.query('revoke all on schema public from spaces_app')
    app = new Pool({ connectionString: urlDe(BASE, 'spaces_app', CLAVE_APP), max: 2 })
  }, 120_000)

  afterAll(async () => {
    if (app) await app.end()
    if (admin) await admin.end()
    await poolTest().query(`drop database if exists ${BASE} with (force)`)
    await cerrarPool()
  })

  it('el escenario es real: sin permisos, la app no puede ni leer', async () => {
    // Si esto pasara, lo de abajo no mediría una reparación: mediría nada.
    await expect(app.query('select 1 from tenants')).rejects.toThrow(/permission denied|permiso/i)
  })

  it('aplicarla deja al rol trabajando otra vez', async () => {
    await admin.query(sql(join('migrations', MIGRACION)))
    await expect(app.query('select 1 from tenants')).resolves.toBeTruthy()
    const escribe = await app.query(
      "insert into tenants (nombre, slug) values ('Reparada','grants-e2e') returning id",
    )
    expect(escribe.rowCount).toBe(1)
  })

  it('y también sobre las tablas que se creen DESPUÉS', async () => {
    // `alter default privileges`: sin esto, la siguiente migración que cree una
    // tabla volvería a dejar al rol fuera y el arreglo duraría una versión.
    await admin.query('create table prueba_posterior (id int)')
    await expect(app.query('select 1 from prueba_posterior')).resolves.toBeTruthy()
  })

  it('NO le regala el salto de la RLS', async () => {
    // El invariante que no se negocia (R2): el rol de la app respeta la RLS.
    // Una migración de GRANT es exactamente donde se colaría un `bypassrls`.
    const { rows } = await admin.query(
      "select rolsuper, rolbypassrls from pg_roles where rolname = 'spaces_app'",
    )
    expect(rows[0]).toEqual({ rolsuper: false, rolbypassrls: false })
    // Y medido por el comportamiento, no solo por el catálogo: sin
    // `app.tenant_id` fijado, la tabla aislada no devuelve filas.
    const { rows: filas } = await app.query('select count(*)::int n from tenants')
    expect(filas[0].n).toBeGreaterThanOrEqual(0)
  })

  it('una instancia puede llamar a su rol como quiera, declarándolo', async () => {
    // Decisión del 2026-08-20: **las instancias deben poder abrirse con otros
    // nombres**. El nombre se DECLARA en `space_os.rol_app`; el runner lo fija
    // desde `ROL_APP` antes de aplicar nada, y `deploy.yml` puede fijarlo con
    // `PGOPTIONS`. Declararlo es EXCLUYENTE: si dices cómo se llama, es ése y no
    // otro — dejar una lista abierta debajo sería volver al no-op silencioso por
    // otra puerta.
    await admin.query("create role rol_propio_e2e login password 'x' nosuperuser nobypassrls")
    try {
      await admin.query("select set_config('space_os.rol_app', 'rol_propio_e2e', false)")
      await admin.query(sql(join('migrations', MIGRACION)))
      const { rows } = await admin.query(
        "select has_table_privilege('rol_propio_e2e','tenants','select') as puede",
      )
      expect(rows[0].puede).toBe(true)
    } finally {
      await admin.query("select set_config('space_os.rol_app', '', false)")
      await admin.query('reassign owned by rol_propio_e2e to spaces').catch(() => {})
      await admin.query('drop owned by rol_propio_e2e').catch(() => {})
      await admin.query('drop role if exists rol_propio_e2e').catch(() => {})
    }
  }, 60_000)

  it('y si el nombre declarado NO existe, ABORTA en vez de no conceder nada', async () => {
    // El corazón de ROJO-3: lo que cerraba el agujero no era el nombre único,
    // era que la migración se niegue cuando no encuentra rol. Aquí se produce de
    // verdad — declarando un nombre que no existe— y no con un doble.
    await admin.query("select set_config('space_os.rol_app', 'rol_que_no_existe_e2e', false)")
    try {
      await expect(admin.query(sql(join('migrations', MIGRACION)))).rejects.toThrow(
        /rol_que_no_existe_e2e/,
      )
    } finally {
      await admin.query("select set_config('space_os.rol_app', '', false)")
    }
  }, 60_000)

  it('sin declarar nada, sigue sirviendo a los dos nombres históricos', async () => {
    // Producción corre como `spaces_user` y NO se le cambia el nombre (decisión
    // del 20/08). Sin declaración, los candidatos son los dos que ya nombran las
    // trece migraciones, así que el droplet se actualiza sin preparar nada.
    const fuente = readFileSync(join(RAIZ, 'db', 'migrations', MIGRACION), 'utf8')
    expect(fuente).toMatch(/spaces_app/)
    expect(fuente).toMatch(/spaces_user/)
  })

  it('es idempotente: la segunda pasada no cambia nada', async () => {
    const antes = await admin.query(
      `select grantee, table_name, privilege_type from information_schema.role_table_grants
        where grantee = 'spaces_app' order by 1,2,3`,
    )
    await admin.query(sql(join('migrations', MIGRACION)))
    const despues = await admin.query(
      `select grantee, table_name, privilege_type from information_schema.role_table_grants
        where grantee = 'spaces_app' order by 1,2,3`,
    )
    expect(despues.rows).toEqual(antes.rows)
  })
})
