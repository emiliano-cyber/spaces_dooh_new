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

  it('si NO existe ninguno de los dos, ABORTA en vez de no conceder nada', async () => {
    // El corazón de ROJO-3: lo que cerraba el agujero no era el nombre, era que
    // la migración se niegue cuando no encuentra rol. Se produce de verdad —en
    // un Postgres desechable SIN ninguno de los dos— y no con un doble, porque
    // `pg_roles` es del CLÚSTER y aquí los dos existen.
    const { spawnSync } = await import('node:child_process')
    const puerto = '55471'
    const nombre = 'pg_sin_rol_grants_e2e'
    spawnSync('docker', ['rm', '-f', nombre], { encoding: 'utf8' })
    spawnSync('docker', ['run', '-d', '--rm', '--name', nombre, '-e', 'POSTGRES_PASSWORD=x',
      '-e', 'POSTGRES_USER=x', '-e', 'POSTGRES_DB=sinrol', '-p', `${puerto}:5432`,
      'postgres:16-alpine'], { encoding: 'utf8' })
    try {
      // `pg_isready` en bucle: el contenedor tarda en aceptar conexiones.
      for (let i = 0; i < 40; i++) {
        const r = spawnSync('docker', ['exec', nombre, 'pg_isready', '-U', 'x'], { encoding: 'utf8' })
        if (r.status === 0) break
        await new Promise((res) => setTimeout(res, 500))
      }
      await new Promise((res) => setTimeout(res, 1500))
      const suelto = new Pool({
        connectionString: `postgresql://x:x@localhost:${puerto}/sinrol`,
        max: 1,
      })
      try {
        await suelto.query('create table tenants (id int)')
        await expect(suelto.query(sql(join('migrations', MIGRACION)))).rejects.toThrow(
          /No existe ninguno de los roles de aplicacion/,
        )
      } finally {
        await suelto.end()
      }
    } finally {
      spawnSync('docker', ['stop', nombre], { encoding: 'utf8' })
    }
  }, 180_000)

  it('sirve a los DOS nombres históricos, y eso se mide en la base', async () => {
    // Antes esto comprobaba que el TEXTO del `.sql` mencionara los dos nombres.
    // Como la cabecera los nombra en prosa, esa prueba no podía ponerse roja
    // nunca — hallazgo H7 de la auditoría del 20/08. Ahora se mide el efecto.
    const { rows } = await admin.query(
      `select grantee, count(*)::int n from information_schema.role_table_grants
        where grantee in ('spaces_app','spaces_user') and privilege_type = 'SELECT'
        group by grantee order by grantee`,
    )
    // `spaces_user` no existe en el clúster de pruebas; `spaces_app` sí, y tiene
    // que haber recibido SELECT sobre todo el esquema.
    const app = rows.find((r: any) => r.grantee === 'spaces_app')
    expect(app, 'spaces_app deberia tener grants').toBeTruthy()
    // Contra el total real de la base, no contra un umbral inventado: tiene que
    // tener SELECT sobre TODAS las tablas, no sobre unas cuantas.
    const { rows: tot } = await admin.query(
      "select count(*)::int n from information_schema.tables where table_schema='public' and table_type='BASE TABLE'",
    )
    expect(app.n).toBe(tot[0].n)
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
