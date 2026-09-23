import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Pool } from 'pg'
import { poolTest, cerrarPool, URL_TEST } from './db-e2e'
import { vigilarPool } from './pool-e2e'

// ============================================================================
//  La migración de tickets tiene que conceder sus GRANT, como sus hermanas.
// ----------------------------------------------------------------------------
//  De las seis migraciones que crean tabla, `20260923_tickets.sql` era la ÚNICA
//  sin un solo `grant` — medido archivo por archivo:
//
//    20260901_doohmain_tracking          5
//    20260907_codigos_recuperacion       3
//    20260917_entidades_fiscales         6
//    20260918_consumos_energia           5
//    20260921_actualizaciones_instancia  16
//    20260923_tickets                    0
//
//  El motivo por el que las otras lo hacen está escrito en
//  `20260917_entidades_fiscales.sql:193`: «En producción las tablas las posee
//  otro rol, así que el GRANT es explícito».
//
//  ─── Por qué la suite e2e de siempre NO podía verlo ───────────────────────
//  `recrearEsquema()` aplica la cadena entera con el rol PROPIETARIO, y en esa
//  cadena va `20260824_grants_tablas_futuras.sql`, que fija privilegios por
//  omisión para las tablas que cree ese mismo rol. Con eso, `tickets` nace con
//  permisos aunque su migración no conceda ninguno. En una instancia de verdad
//  —donde las tablas las posee otro rol— la tabla se crea, la migración sale 0,
//  y después `spaces_app` no puede leerla. Ningún error apunta a permisos.
//
//  Por eso esta base desechable reproduce el caso de producción y NO el del
//  arnés: se aplica `schema.sql` y la migración de tickets, y nada más. Sin
//  privilegios por omisión de por medio, lo único que puede dar permiso a
//  `spaces_app` sobre `tickets` es la propia migración.
// ============================================================================

const RAIZ = join(process.cwd(), '..', '..')
const MIGRACION = '20260923_tickets.sql'
const BASE = 'spaces_tickets_grants_e2e'
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

describe('la migración de tickets concede permisos al rol de la app', () => {
  let admin: Pool
  let app: Pool

  beforeAll(async () => {
    if (!BASE.endsWith('_e2e')) throw new Error('la base desechable debe acabar en _e2e')
    const raiz = poolTest()
    await raiz.query(`drop database if exists ${BASE} with (force)`)
    await raiz.query(`create database ${BASE}`)
    admin = new Pool({ connectionString: urlDe(BASE), max: 2 })
    vigilarPool(admin, `${BASE} (admin)`)
    // El rol es del clúster y ya existe; `dev-rol-app.sql` es idempotente.
    await admin.query(sql('dev-rol-app.sql'))
    // Solo el esquema base. NADA de `20260824_grants_tablas_futuras.sql`: es
    // justamente lo que tapa el agujero en el arnés y lo que una instancia de
    // verdad no tiene cuando el propietario de las tablas es otro rol.
    await admin.query(sql('schema.sql'))
    app = new Pool({ connectionString: urlDe(BASE, 'spaces_app', CLAVE_APP), max: 2 })
    vigilarPool(app, `${BASE} (spaces_app)`)
  }, 120_000)

  afterAll(async () => {
    if (app) await app.end()
    if (admin) await admin.end()
    await poolTest().query(`drop database if exists ${BASE} with (force)`)
    await cerrarPool()
  })

  it('el escenario es real: aquí nada le regala permisos al rol de la app', async () => {
    // Si esto pasara, lo de abajo no mediría el GRANT de la migración: mediría
    // los privilegios por omisión de otra. Mismo canario que
    // `grants-rol-app.e2e.test.ts`.
    await expect(app.query('select 1 from tenants')).rejects.toThrow(/permission denied|permiso/i)
  })

  it('tras aplicarla, la app puede LEER los tickets', async () => {
    await admin.query(sql(join('migrations', MIGRACION)))
    await expect(app.query('select 1 from tickets')).resolves.toBeTruthy()
  })

  it('y escribirlos: el dueño de la instancia abre tickets desde su pantalla', async () => {
    // Sin `insert` la pantalla de Administración daría `permission denied` al
    // primer ticket, que es el único camino por el que esta tabla se llena.
    const { rows: t } = await admin.query(
      "insert into tenants (nombre, slug) values ('Tickets Grants','tickets-grants-e2e') returning id",
    )
    await expect(
      app.query(
        "insert into tickets (tenant_id, folio, asunto, cuerpo) values ($1,'TK-E2E-0001','asunto','cuerpo')",
        [t[0].id],
      ),
    ).resolves.toBeTruthy()
    // Y el PATCH del panel, que es un `update` sobre la misma tabla.
    await expect(
      app.query("update tickets set respuesta = 'ya se reviso' where folio = 'TK-E2E-0001'"),
    ).resolves.toBeTruthy()
  })

  it('NO le regala el salto de la RLS', async () => {
    // Invariante R2, repetido a propósito: una migración de GRANT es
    // exactamente donde se colaría un `bypassrls` para «arreglar» un
    // permission denied, y sin dar ningún error.
    const { rows } = await admin.query(
      "select rolsuper, rolbypassrls from pg_roles where rolname = 'spaces_app'",
    )
    expect(rows[0]).toEqual({ rolsuper: false, rolbypassrls: false })
  })

  it('es idempotente: una segunda pasada no cambia ni un privilegio', async () => {
    // `20260923_tickets.sql` YA está aplicada en el 5433 y en `spaces_e2e`, así
    // que este cambio tiene que poder reaplicarse sobre una base que ya lo
    // tiene sin romper nada.
    const antes = await admin.query(
      `select grantee, table_name, privilege_type from information_schema.role_table_grants
        where table_name = 'tickets' order by 1,2,3`,
    )
    await admin.query(sql(join('migrations', MIGRACION)))
    const despues = await admin.query(
      `select grantee, table_name, privilege_type from information_schema.role_table_grants
        where table_name = 'tickets' order by 1,2,3`,
    )
    expect(despues.rows).toEqual(antes.rows)
  })
})
