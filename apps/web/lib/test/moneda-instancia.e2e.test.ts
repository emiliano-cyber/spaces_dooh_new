import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { recrearEsquema, cerrarPool, poolTest, comoTenant } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  ADR 0048 · LA MONEDA DE LA INSTANCIA NO SE CAMBIA — las dos capas.
//
//  Decision del dueno (02/11): la moneda (MXN o USD) se elige al crear la
//  instancia y despues NO se puede cambiar. Los importes guardados no llevan
//  moneda propia: cambiarla los reinterpretaria sin convertirlos.
//
//  Dos capas, y aqui se prueban las dos POR LO QUE IMPIDEN:
//
//    1. La BASE (`20261102_moneda_inmutable_por_instancia.sql`): CHECK, un
//       trigger que impide el UPDATE y otro que impide una segunda moneda.
//       Se prueba con el superusuario y con el rol de la app: un trigger no
//       es un permiso, y tiene que parar a los dos.
//    2. La API: `PATCH /api/config` rechaza `moneda` con un 400 que dice por
//       que, antes de guardar nada.
//
//  Y el positivo que pidio el dueno: una instancia que ya existe sigue en MXN.
//  La creacion (elegir USD, rechazar EUR) va en `bootstrap.e2e.test.ts`, que
//  es donde se puede vaciar la base y entrar por la puerta de un solo uso.
// ============================================================================

let alfa: Awaited<ReturnType<typeof sembrarTenant>>
let ca: Cliente

const MIGRACION = join(process.cwd(), '..', '..', 'db', 'migrations', '20261102_moneda_inmutable_por_instancia.sql')

async function monedaDe(tabla: 'tenants' | 'config_negocio', id: string): Promise<string> {
  const col = tabla === 'tenants' ? 'id' : 'tenant_id'
  const r = await poolTest().query(`select moneda from ${tabla} where ${col} = $1`, [id])
  return r.rows[0]?.moneda
}

/** Ejecuta y devuelve el mensaje del error, o `null` si NO fallo. */
async function falla(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn()
    return null
  } catch (e) {
    return (e as Error).message
  }
}

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  alfa = await sembrarTenant('monedaalfa')
  await arrancarServidor()
  ca = new Cliente()
  await ca.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

describe('una instancia que YA existe se queda en MXN', () => {
  it('toda organizacion y toda configuracion siguen en MXN tras la migracion', async () => {
    // `recrearEsquema()` aplica las migraciones SOBRE una base que ya tiene
    // organizacion (`semilla-desarrollo.sql`), que es el caso del droplet.
    const t = await poolTest().query('select distinct moneda from tenants')
    const c = await poolTest().query('select distinct moneda from config_negocio')
    expect(t.rows.map((r) => r.moneda)).toEqual(['MXN'])
    expect(c.rows.map((r) => r.moneda)).toEqual(['MXN'])
  })

  it('y la app la sirve como MXN', async () => {
    const r = await ca.pedir('/api/config/')
    expect(r.status).toBe(200)
    expect(r.datos.moneda).toBe('MXN')
  })

  it('la migracion es idempotente: aplicarla otra vez no rompe ni cambia nada', async () => {
    await poolTest().query(readFileSync(MIGRACION, 'utf8'))
    expect(await monedaDe('tenants', alfa.id)).toBe('MXN')
    const trig = await poolTest().query(
      `select count(*)::int n from pg_trigger where tgname in
        ('trg_tenants_moneda_inmutable','trg_tenants_moneda_unica',
         'trg_config_negocio_moneda_inmutable','trg_config_negocio_moneda_espejo')`,
    )
    expect(trig.rows[0].n).toBe(4)
  })
})

describe('CAPA 1 · la base no deja cambiarla', () => {
  it('NEGATIVO · UPDATE de tenants.moneda falla, incluso con el superusuario', async () => {
    const error = await falla(() =>
      poolTest().query("update tenants set moneda = 'USD' where id = $1", [alfa.id]),
    )
    expect(error).toMatch(/moneda de la instancia no se puede cambiar/)
    expect(await monedaDe('tenants', alfa.id)).toBe('MXN')
  })

  it('NEGATIVO · UPDATE de config_negocio.moneda falla', async () => {
    const error = await falla(() =>
      poolTest().query("update config_negocio set moneda = 'USD' where tenant_id = $1", [alfa.id]),
    )
    expect(error).toMatch(/moneda de la instancia no se puede cambiar/)
    expect(await monedaDe('config_negocio', alfa.id)).toBe('MXN')
  })

  it('NEGATIVO · y con el rol de la APP, dentro de su organizacion, tampoco', async () => {
    // El rol de la app SI puede escribir `config_negocio` de su tenant (es lo
    // que hace `PATCH /api/config`). Lo que la para es el trigger, no un permiso.
    const error = await falla(() =>
      comoTenant(alfa.id, (q) => q("update config_negocio set moneda = 'USD' where tenant_id = $1", [alfa.id])),
    )
    expect(error).toMatch(/moneda de la instancia no se puede cambiar/)
    expect(await monedaDe('config_negocio', alfa.id)).toBe('MXN')
  })

  it('reescribir el MISMO valor si pasa (los upserts de las semillas lo hacen)', async () => {
    await poolTest().query("update tenants set moneda = 'MXN', nombre = nombre where id = $1", [alfa.id])
    await poolTest().query("update config_negocio set moneda = 'MXN' where tenant_id = $1", [alfa.id])
    expect(await monedaDe('tenants', alfa.id)).toBe('MXN')
  })

  it('NEGATIVO · una organizacion nueva en OTRA moneda no nace (una moneda por instancia)', async () => {
    const error = await falla(() =>
      poolTest().query("insert into tenants (nombre, slug, moneda) values ('Dolares', 'dolares-e2e', 'USD')"),
    )
    expect(error).toMatch(/trabaja en MXN/)
    const r = await poolTest().query("select count(*)::int n from tenants where slug = 'dolares-e2e'")
    expect(r.rows[0].n).toBe(0)
  })

  it('NEGATIVO · una moneda que no es MXN ni USD no entra, ni siquiera sin la regla de unicidad', async () => {
    // Con organizaciones en MXN, el trigger de unicidad salta ANTES que el
    // CHECK. Para ver el CHECK solo, se apaga ese trigger dentro de una
    // transaccion que se deshace: lo que se mide es la segunda red.
    const c = await poolTest().connect()
    try {
      await c.query('begin')
      await c.query('alter table tenants disable trigger trg_tenants_moneda_unica')
      const error = await falla(() =>
        c.query("insert into tenants (nombre, slug, moneda) values ('Euros', 'euros-e2e', 'EUR')"),
      )
      expect(error).toMatch(/tenants_moneda_ck/)
    } finally {
      await c.query('rollback')
      c.release()
    }
    const trig = await poolTest().query(
      "select tgenabled from pg_trigger where tgname = 'trg_tenants_moneda_unica'",
    )
    expect(trig.rows[0].tgenabled).toBe('O') // sigue encendido
  })

  it('config_negocio nace con la moneda de su organizacion, venga lo que venga en el INSERT', async () => {
    // `obtenerConfigRow()` crea la fila perezosamente con los DEFAULT. Sin el
    // espejo, en una instancia USD habria nacido en MXN.
    const beta = await poolTest().query(
      "insert into tenants (nombre, slug) values ('Beta', 'moneda-beta-e2e') returning id",
    )
    const id = beta.rows[0].id
    await poolTest().query("insert into config_negocio (tenant_id, moneda) values ($1, 'USD')", [id])
    expect(await monedaDe('config_negocio', id)).toBe('MXN')
  })
})

describe('CAPA 2 · la API no deja cambiarla', () => {
  it('NEGATIVO · PATCH /api/config con otra moneda es un 400 que dice por que, y no guarda nada', async () => {
    const r = await ca.pedir('/api/config/', { metodo: 'PATCH', cuerpo: { moneda: 'USD', loopSeg: 45 } })
    expect(r.status).toBe(400)
    expect(r.datos.error).toBe(
      'La moneda no se puede cambiar: se eligió al crear la instancia y los importes guardados no la llevan',
    )
    expect(await monedaDe('config_negocio', alfa.id)).toBe('MXN')
    // Y el campo que venia al lado NO se guardo: el rechazo va antes de todo.
    const cfg = await poolTest().query('select loop_seg from config_negocio where tenant_id = $1', [alfa.id])
    expect(Number(cfg.rows[0].loop_seg)).toBe(60)
  })

  it('NEGATIVO · tambien con la MISMA moneda: el campo no se acepta, no se compara', async () => {
    const r = await ca.pedir('/api/config/', { metodo: 'PATCH', cuerpo: { moneda: 'MXN' } })
    expect(r.status).toBe(400)
  })

  it('NEGATIVO · y con una que ni existe (EUR), el mismo 400', async () => {
    const r = await ca.pedir('/api/config/', { metodo: 'PATCH', cuerpo: { moneda: 'EUR' } })
    expect(r.status).toBe(400)
    expect(await monedaDe('config_negocio', alfa.id)).toBe('MXN')
  })

  it('el resto de la configuracion se sigue guardando como siempre', async () => {
    const r = await ca.pedir('/api/config/', { metodo: 'PATCH', cuerpo: { loopSeg: 45 } })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.loopSeg).toBe(45)
    expect(r.datos.moneda).toBe('MXN')
  })
})
