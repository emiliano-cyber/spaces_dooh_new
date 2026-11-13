import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest, comoTenant } from './db-e2e'
import { sembrarTenant } from './semillas-e2e'
import {
  SQL_AVISOS_PROPIOS,
  SQL_DESTINATARIOS,
  SQL_GUARDAR_AVISOS,
  SQL_IDENTIDAD_ORG,
  SQL_TELEFONO_PROPIO,
} from '../server/avisos-sql'

// ============================================================================
//  AVISOS-CANAL (12/11) · la migracion `20261112_avisos_por_canal.sql` y las
//  sentencias de `avisos-repo.ts`, contra Postgres REAL.
// ----------------------------------------------------------------------------
//  Con el rol `spaces_app` y `app.tenant_id` fijado (`comoTenant`), que es como
//  corre la aplicacion. Lo que las unitarias no pueden ver: la RLS, los checks
//  de la migracion y que el CTE de guardado deje las preferencias EXACTAMENTE
//  como vienen. Las mismas sentencias que la app (`avisos-sql.ts`), no copias.
// ============================================================================

let a: Awaited<ReturnType<typeof sembrarTenant>>
let b: Awaited<ReturnType<typeof sembrarTenant>>
let usuarioA = ''
let usuarioB = ''

const idDe = async (email: string) =>
  (await poolTest().query('select id from usuarios where email = $1', [email])).rows[0].id as string

const guardar = (tenant: string, usuario: string, activos: [string, string][], telefono: string | null) =>
  comoTenant(tenant, (q) =>
    q(SQL_GUARDAR_AVISOS, [usuario, tenant, telefono, activos.map((x) => x[0]), activos.map((x) => x[1])]),
  )
const propios = (tenant: string, usuario: string) =>
  comoTenant(tenant, (q) => q(SQL_AVISOS_PROPIOS, [usuario, tenant]))
const destinatarios = (tenant: string, tenantParam: string, tipo: string, canal = 'correo') =>
  comoTenant(tenant, (q) => q(SQL_DESTINATARIOS, [tenantParam, tipo, canal]))

beforeAll(async () => {
  await recrearEsquema()
  a = await sembrarTenant('avisosa')
  b = await sembrarTenant('avisosb')
  usuarioA = await idDe(a.usuarioEmail)
  usuarioB = await idDe(b.usuarioEmail)
}, 180_000)

afterAll(async () => {
  await cerrarPool()
})

describe('la migracion', () => {
  it('sin preferencias nadie recibe nada: aplicar la migracion no enciende correos', async () => {
    expect(await destinatarios(a.id, a.id, 'FACTURA')).toEqual([])
    const t = await comoTenant(a.id, (q) => q(SQL_TELEFONO_PROPIO, [usuarioA, a.id]))
    expect(t).toEqual([{ telefono_whatsapp: null }])
  })

  it('el telefono solo se guarda en E.164', async () => {
    await expect(
      poolTest().query('update usuarios set telefono_whatsapp = $1 where id = $2', ['5512345678', usuarioA]),
    ).rejects.toMatchObject({ code: '23514' })
  })

  it('el canal solo puede ser correo o whatsapp', async () => {
    await expect(
      poolTest().query(
        `insert into avisos_usuario (tenant_id, usuario_id, tipo, canal) values ($1,$2,'PAGO','sms')`,
        [a.id, usuarioA],
      ),
    ).rejects.toMatchObject({ code: '23514' })
  })

  it('es idempotente: se puede aplicar dos veces', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const sql = readFileSync(join(process.cwd(), '..', '..', 'db', 'migrations', '20261112_avisos_por_canal.sql'), 'utf8')
    await expect(poolTest().query(sql)).resolves.toBeDefined()
  })
})

describe('guardar las preferencias propias', () => {
  it('guarda, y devuelve la cuenta', async () => {
    const r = await guardar(a.id, usuarioA, [['FACTURA', 'correo'], ['OT', 'correo']], '+525512345678')
    expect(r).toHaveLength(1)
    expect(await propios(a.id, usuarioA)).toEqual([
      { tipo: 'FACTURA', canal: 'correo' },
      { tipo: 'OT', canal: 'correo' },
    ])
    const t = await comoTenant(a.id, (q) => q(SQL_TELEFONO_PROPIO, [usuarioA, a.id]))
    expect(t[0].telefono_whatsapp).toBe('+525512345678')
  })

  it('lo que no viene se APAGA, y lo que ya estaba no se duplica', async () => {
    await guardar(a.id, usuarioA, [['OT', 'correo'], ['PAGO', 'correo']], null)
    expect(await propios(a.id, usuarioA)).toEqual([
      { tipo: 'OT', canal: 'correo' },
      { tipo: 'PAGO', canal: 'correo' },
    ])
  })

  it('una lista vacia lo apaga todo', async () => {
    await guardar(a.id, usuarioA, [], null)
    expect(await propios(a.id, usuarioA)).toEqual([])
  })

  it('desde OTRA organizacion no se toca nada, ni el telefono (RLS)', async () => {
    await guardar(a.id, usuarioA, [['FACTURA', 'correo']], '+525512345678')
    // B intenta escribir en la cuenta de A diciendo que es de A: la RLS no le
    // deja ver la fila de usuarios, el CTE no encuentra cuenta y no escribe.
    const r = await guardar(b.id, usuarioA, [['PAGO', 'correo']], '+5215599999999')
    expect(r).toEqual([])
    expect(await propios(a.id, usuarioA)).toEqual([{ tipo: 'FACTURA', canal: 'correo' }])
    const t = await comoTenant(a.id, (q) => q(SQL_TELEFONO_PROPIO, [usuarioA, a.id]))
    expect(t[0].telefono_whatsapp).toBe('+525512345678')
  })

  it('y con su propio tenant pero el usuario de otro, tampoco', async () => {
    const r = await guardar(b.id, usuarioA, [['PAGO', 'correo']], null)
    expect(r).toEqual([])
    const filas = await poolTest().query('select count(*)::int as n from avisos_usuario where tenant_id = $1', [b.id])
    expect(filas.rows[0].n).toBe(0)
  })
})

describe('a quien se le manda', () => {
  it('a quien lo encendio, en su organizacion', async () => {
    await guardar(a.id, usuarioA, [['FACTURA', 'correo']], null)
    expect(await destinatarios(a.id, a.id, 'FACTURA')).toEqual([
      { email: a.usuarioEmail, nombre: 'Dueño avisosa', telefono: null },
    ])
    expect(await destinatarios(a.id, a.id, 'PAGO')).toEqual([])
  })

  it('desde otra organizacion no se ve a nadie, aunque pregunte por el tenant de A', async () => {
    expect(await destinatarios(b.id, a.id, 'FACTURA')).toEqual([])
  })

  it('sin tenant fijado (el error de usar qRaw) no se ve a nadie', async () => {
    const r = await comoTenant('', (q) => q(SQL_DESTINATARIOS, [a.id, 'FACTURA', 'correo'])).catch(() => [])
    expect(r).toEqual([])
  })

  it('un usuario desactivado deja de recibir', async () => {
    await poolTest().query('update usuarios set activo = false where id = $1', [usuarioA])
    expect(await destinatarios(a.id, a.id, 'FACTURA')).toEqual([])
    await poolTest().query('update usuarios set activo = true where id = $1', [usuarioA])
  })

  it('la identidad de la organizacion se lee con su tenant', async () => {
    const r = await comoTenant(a.id, (q) => q(SQL_IDENTIDAD_ORG, [a.id]))
    expect(r[0].nombre).toBe('Org AVISOSA')
  })

  it('borrar a la persona se lleva sus preferencias', async () => {
    await guardar(b.id, usuarioB, [['OT', 'correo']], null)
    await poolTest().query('delete from usuarios where id = $1', [usuarioB])
    const filas = await poolTest().query('select count(*)::int as n from avisos_usuario where usuario_id = $1', [usuarioB])
    expect(filas.rows[0].n).toBe(0)
  })
})
