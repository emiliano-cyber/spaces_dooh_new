import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { PoolClient } from 'pg'
import { recrearEsquema, cerrarPool, poolTest, poolApp, comoTenant } from './db-e2e'
import { asegurarPermisos, sembrarTenant } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'
import { planCatalogo, sentenciasDelCatalogo, sentenciasDeshacer } from '../../../../scripts/semilla-catalogo-demo.mjs'

// ============================================================================
//  VALLAS EN LA DEMO (pedido del dueño, 19/11) · la semilla del CATÁLOGO
//  contra Postgres y Next reales.
// ----------------------------------------------------------------------------
//  La demo se siembra con `scripts/semilla-catalogo-demo.mjs` (lo corre una
//  persona, ver `infra/scripts/sembrar-catalogo-demo.sh`). Aquí se corren SUS
//  MISMAS sentencias, como lo hace su `main`: en una transacción con
//  `app.tenant_id`. La parte de vallas, con el rol de la APP (RLS forzada en
//  sus tres tablas), para que un `set_config` olvidado se vea aquí y no en la
//  demo.
//
//   1. Siembra 8 vallas, los dos grupos (una imagen y separadas), las 12
//      categorías y la marca de las campañas; la 2.ª corrida no mete nada.
//      CAT-V02 dobla a la derecha (la esquina del plano, 20/11).
//   2. Con el tenant de OTRA organización no escribe ni ve nada.
//   3. «Verificar una marca» con Pepsi junto a la Coca-Cola al aire da AVISO.
//   4. `--deshacer` se lleva las vallas antes que los sitios y deja las
//      categorías (son las de omisión, no un ejemplo).
// ============================================================================

const CLAVE = 'clave-e2e-vallas-1234'
const plan = planCatalogo({ slug: 'demo-vallas-e2e', nombreOrg: 'Space OS Demo' })
let T: string
let otra: Awaited<ReturnType<typeof sembrarTenant>>
let dueno: Cliente

type Sentencia = { etiqueta: string; sql: string; valores: unknown[]; vallas?: boolean }
const todas = (): Sentencia[] => sentenciasDelCatalogo(plan, T, CLAVE)
const deVallas = () => todas().filter((s) => s.vallas)

async function enTransaccion(cli: PoolClient, tenant: string | null, sentencias: Sentencia[]): Promise<number> {
  let filas = 0
  await cli.query('begin')
  try {
    if (tenant) await cli.query('select set_config($1, $2, true)', ['app.tenant_id', tenant])
    for (const s of sentencias) filas += (await cli.query(s.sql, s.valores)).rowCount ?? 0
    await cli.query('commit')
  } catch (e) {
    await cli.query('rollback')
    throw e
  }
  return filas
}

async function comoApp(tenant: string | null, sentencias: Sentencia[]): Promise<number> {
  const cli = await poolApp().connect()
  try {
    return await enTransaccion(cli, tenant, sentencias)
  } finally {
    cli.release()
  }
}

const contar = (tenant: string) =>
  comoTenant(tenant, async (q) => ({
    vallas: (await q('select count(*)::int n from vallas'))[0].n,
    inactivas: (await q('select count(*)::int n from vallas where not activo'))[0].n,
    grupos: (await q("select string_agg(modo, ',' order by numero) m from vallas_grupos"))[0].m,
    categorias: (await q('select count(*)::int n from competencia_categorias'))[0].n,
  }))

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  otra = await sembrarTenant('vallas-demo-otra')
  T = (
    await poolTest().query(
      `insert into tenants (nombre, slug, moneda) values ('Space OS Demo', $1, 'MXN') returning id`,
      [plan.organizacion.slug],
    )
  ).rows[0].id
  // Todo el catálogo menos las vallas, como el script (con el migrador).
  const cli = await poolTest().connect()
  try {
    await enTransaccion(cli, T, todas().filter((s) => !s.vallas))
  } finally {
    cli.release()
  }
  await arrancarServidor()
  dueno = new Cliente()
  await dueno.entrar('dueno@catalogo.invalid', CLAVE)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

describe('la semilla del catálogo trae vallas para la demo', () => {
  // Sin el tenant correcto, o la RLS rechaza la fila (la categoría no pasa el
  // `with check`) y la transacción vuelve atrás entera, o no ve los sitios de
  // la demo y no inserta nada. Las dos cosas valen; escribir, no.
  const rechazadoOCero = (p: Promise<number>) => p.then((n) => n, () => 'rechazado')

  it('con el rol de la app y SIN tenant no escribe nada (RLS forzada)', async () => {
    expect([0, 'rechazado']).toContain(await rechazadoOCero(comoApp(null, deVallas())))
    expect(await contar(T)).toEqual({ vallas: 0, inactivas: 0, grupos: null, categorias: 0 })
  })

  it('con el tenant de OTRA organización no escribe nada en la demo ni en la otra', async () => {
    expect([0, 'rechazado']).toContain(await rechazadoOCero(comoApp(otra.id, deVallas())))
    expect(await contar(T)).toEqual({ vallas: 0, inactivas: 0, grupos: null, categorias: 0 })
    expect((await contar(otra.id)).vallas).toBe(0)
  })

  it('siembra 8 vallas (una inactiva), un grupo de una imagen y uno separado, y las 12 categorías', async () => {
    expect(await comoApp(T, deVallas())).toBeGreaterThan(0)
    expect(await contar(T)).toEqual({ vallas: 8, inactivas: 1, grupos: 'una_imagen,separadas', categorias: 12 })
    const marcas = await comoTenant(T, (q) =>
      q(`select folio, marca from campanas where folio in ('CAT-CMP-013', 'CAT-CMP-014', 'CAT-CMP-018', 'CAT-CMP-015') order by folio`),
    )
    expect(marcas.map((r: { marca: string }) => r.marca)).toEqual(['Coca-Cola', 'Telcel', 'Cadena', 'Nissan'])
  })

  it('es idempotente: la segunda corrida no mete ni cambia nada', async () => {
    expect(await comoApp(T, deVallas())).toBe(0)
    expect((await contar(T)).vallas).toBe(8)
  })

  it('la pantalla las ve: 7 activas y 1 inactiva, CAT-V01..V03 en el grupo de una imagen', async () => {
    const r = await dueno.pedir('/api/vallas/')
    expect(r.status).toBe(200)
    expect(r.datos.vallas).toHaveLength(8)
    const g01 = r.datos.grupos.find((g: { numero: string }) => g.numero === 'CAT-G01')
    expect(g01.modo).toBe('una_imagen')
    expect(r.datos.vallas.filter((v: { grupoId: string }) => v.grupoId === g01.id).map((v: { numero: string }) => v.numero).sort()).toEqual([
      'CAT-V01',
      'CAT-V02',
      'CAT-V03',
    ])
    // La esquina (20/11): CAT-V02 dobla a la derecha y las demás van rectas.
    expect(r.datos.vallas.filter((v: { dobla: string | null }) => v.dobla).map((v: { numero: string; dobla: string }) => [v.numero, v.dobla])).toEqual([
      ['CAT-V02', 'derecha'],
    ])
  })

  it('«Verificar una marca»: Pepsi junto a la Coca-Cola al aire AVISA, y no bloquea', async () => {
    const { datos } = await dueno.pedir('/api/vallas/')
    const id = (n: string) => datos.vallas.find((v: { numero: string }) => v.numero === n).id
    const pepsi = await dueno.pedir('/api/vallas/verificar/', {
      cuerpo: { marca: 'Pepsi', fechaInicio: plan.hoy, fechaFin: plan.hoy, vallaIds: [id('CAT-V01')] },
    })
    expect(pepsi.status).toBe(200)
    expect(pepsi.datos.bloquea).toBe(false)
    expect(pepsi.datos.hallazgos.length).toBeGreaterThan(0)
    expect(pepsi.datos.hallazgos[0].nivel).toBe('aviso')
    expect(JSON.stringify(pepsi.datos.hallazgos[0])).toContain('Coca-Cola')
    // Y muerde: en el espectacular de Guadalajara no hay Coca-Cola.
    const libre = await dueno.pedir('/api/vallas/verificar/', {
      cuerpo: { marca: 'Pepsi', fechaInicio: plan.hoy, fechaFin: plan.hoy, vallaIds: [id('CAT-V07')] },
    })
    expect(libre.datos.hallazgos).toEqual([])
  })

  it('deshacer se lleva las vallas y los grupos (antes que los sitios) y deja las categorías', async () => {
    const cli = await poolTest().connect()
    try {
      await enTransaccion(cli, T, sentenciasDeshacer(plan, T))
    } finally {
      cli.release()
    }
    expect(await contar(T)).toEqual({ vallas: 0, inactivas: 0, grupos: null, categorias: 12 })
  })
})
