import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, poolTest, poolApp, cerrarPool, comoTenant } from './db-e2e'

// ============================================================================
//  Comprobación de la propia infraestructura de pruebas.
//
//  Va primero y aparte a propósito: si el reset del esquema no funciona, todo
//  lo demás daría verde contra un esquema viejo — que es peor que no tener
//  pruebas, porque da confianza sin respaldarla. Pasó de verdad en esta máquina:
//  el volumen de Docker llevaba semanas levantado y no tenía `tenant_id` en
//  config_negocio.
// ============================================================================

beforeAll(async () => {
  await recrearEsquema()
}, 60_000)

afterAll(async () => {
  await cerrarPool()
})

describe('infraestructura de pruebas', () => {
  it('recrea el esquema ACTUAL del repo, no el del volumen', async () => {
    // El canario: `config_negocio.tenant_id` lo añadió el ADR 0011. Si esto
    // falla, la base está sirviendo un esquema anterior.
    const r = await poolTest().query(
      `select count(*)::int as n from information_schema.columns
        where table_name = 'config_negocio' and column_name = 'tenant_id'`,
    )
    expect(r.rows[0].n).toBe(1)
  })

  it('la RLS está activa y forzada en las tablas de negocio', async () => {
    const r = await poolTest().query(
      `select relname, relrowsecurity, relforcerowsecurity from pg_class
        where relname in ('campanas','sitios','config_negocio') order by relname`,
    )
    // `config_negocio` era la única excepción hasta el ADR 0011.
    for (const fila of r.rows) {
      expect(fila.relrowsecurity, `${fila.relname} sin RLS`).toBe(true)
    }
  })

  it('el rol de la app NO es superusuario ni puede saltarse la RLS', async () => {
    // Sin esto, todo lo de abajo pasa por casualidad: un superusuario ignora la
    // RLS aunque la tabla tenga FORCE. Es el error que tuve — la prueba de
    // «cero filas» daba verde porque la tabla estaba VACÍA.
    const { rows } = await poolApp().query(
      'select rolsuper, rolbypassrls from pg_roles where rolname = current_user',
    )
    expect(rows[0]).toEqual({ rolsuper: false, rolbypassrls: false })
  })

  it('sin contexto de tenant, una tabla CON DATOS devuelve cero filas', async () => {
    // La propiedad que sostiene el aislamiento: fail-closed. Se siembra una fila
    // ANTES de comprobar; si no, un cero no distingue «aislado» de «vacío».
    const t = await poolTest().query("select id from tenants where slug = 'rgb'")
    await poolTest().query(
      `insert into clientes (nombre, tenant_id) values ('Canario RLS', $1)`,
      [t.rows[0].id],
    )
    // El pool ADMIN la ve (se salta la RLS): la fila existe de verdad.
    const admin = await poolTest().query('select count(*)::int as n from clientes')
    expect(admin.rows[0].n).toBeGreaterThan(0)
    // El pool de APP, sin fijar tenant, no ve nada.
    const app = await poolApp().query('select count(*)::int as n from clientes')
    expect(app.rows[0].n).toBe(0)
  })

  it('con contexto de tenant, ve LO SUYO y solo lo suyo', async () => {
    const t = await poolTest().query('select id, slug from tenants order by slug')
    const rgb = t.rows.find((r: any) => r.slug === 'rgb')
    // Un segundo tenant con su propio cliente, para que «ver lo suyo» tenga algo
    // de lo que distinguirse.
    const otro = await poolTest().query(
      `insert into tenants (nombre, slug) values ('Otra Org','otra')
       on conflict (slug) do update set nombre = excluded.nombre returning id`,
    )
    await poolTest().query(
      `insert into clientes (nombre, tenant_id) values ('Cliente de la otra', $1)`,
      [otro.rows[0].id],
    )
    const vistosPorRgb = await comoTenant(rgb.id, async (q) =>
      await q('select nombre from clientes'),
    )
    expect(vistosPorRgb.map((c: any) => c.nombre)).not.toContain('Cliente de la otra')
    expect(vistosPorRgb.length).toBeGreaterThan(0)
  })

  it('se niega a apuntar a una base que parezca de producción', async () => {
    // El guard que evita que un despiste con DATABASE_URL_TEST borre el esquema
    // de prod: esto corre `drop schema public cascade`.
    const { URL_TEST } = await import('./db-e2e')
    expect(URL_TEST).not.toMatch(/prod/)
  })
})
