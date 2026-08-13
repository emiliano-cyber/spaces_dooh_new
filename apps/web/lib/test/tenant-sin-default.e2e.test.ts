import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { recrearEsquema, poolTest, cerrarPool } from './db-e2e'

// ============================================================================
//  El DEFAULT de tenant_id no debe existir: un insert descuidado TRUENA.
// ----------------------------------------------------------------------------
//  `db/schema.sql:615` pone un DEFAULT apuntando al tenant 'rgb' en las 23
//  tablas del bucle. Su modo de fallo es el peor que hay: no da error. Una fila
//  insertada sin fijar tenant no queda huérfana ni revienta — nace atribuida a
//  RGB, en silencio, dentro de otra organización. Es la misma familia de fallo
//  que R2 en [[zonas-de-riesgo]], y ya dejó 15 modalidades de g500/eyro
//  etiquetadas como RGB.
//
//  La migración `20260812_sin_default_tenant.sql` lo retira. Estas pruebas
//  miden el esquema REAL del repo: `recrearEsquema()` aplica `schema.sql` más
//  todas las migraciones en orden, así que lo que se comprueba aquí es lo que
//  levantaría una instalación nueva.
//
//  Se usa el pool ADMIN a propósito: es superusuario y se salta la RLS, así que
//  un rechazo aquí solo puede venir del NOT NULL, no de una política. Con el
//  pool de app, un 42501 de la RLS podría hacer pasar la prueba por el motivo
//  equivocado.
// ============================================================================

const RUTA_MIGRACION = join(
  process.cwd(), '..', '..', 'db', 'migrations', '20260812_sin_default_tenant.sql',
)

beforeAll(async () => {
  await recrearEsquema()
}, 60_000)

afterAll(async () => {
  await cerrarPool()
})

describe('tenant_id sin DEFAULT', () => {
  it('un insert SIN tenant_id se rechaza con 23502 en vez de nacer como rgb', async () => {
    // El caso que importa. Hoy —con el default puesto— este insert funciona y
    // crea un cliente que pertenece a RGB sin que nadie lo haya decidido.
    await expect(
      poolTest().query("insert into clientes (nombre) values ('Sin dueño')"),
    ).rejects.toMatchObject({ code: '23502' })
  })

  it('el mismo insert CON tenant_id explícito sigue funcionando', async () => {
    // No regresión: quitar el default no puede romper la escritura legítima.
    // Todos los repos pasan tenant_id explícito, así que esta es la forma real.
    const t = await poolTest().query("select id from tenants where slug = 'rgb'")
    const { rows } = await poolTest().query(
      "insert into clientes (nombre, tenant_id) values ('Con dueño', $1) returning id, tenant_id",
      [t.rows[0].id],
    )
    expect(rows[0].tenant_id).toBe(t.rows[0].id)
  })

  it('el catálogo no devuelve ninguna columna tenant_id con DEFAULT', async () => {
    // Se mira el CATÁLOGO y no una lista escrita a mano: el día que alguien
    // añada una tabla con el default copiado, esta prueba se pone roja sola.
    const { rows } = await poolTest().query(
      `select c.relname from pg_attrdef d
         join pg_class c on c.oid = d.adrelid
         join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and a.attname = 'tenant_id'
        order by c.relname`,
    )
    expect(rows.map((r: any) => r.relname)).toEqual([])
  })

  it('aplicar la migración dos veces seguidas no lanza', async () => {
    // Idempotencia de verdad, no supuesta: `recrearEsquema()` ya la aplicó una
    // vez, así que estas son la segunda y la tercera. Una migración que solo
    // funciona sobre esquema virgen es una bomba para el runner de la flota.
    const sql = readFileSync(RUTA_MIGRACION, 'utf8')
    await expect(poolTest().query(sql)).resolves.toBeDefined()
    await expect(poolTest().query(sql)).resolves.toBeDefined()
  })
})
