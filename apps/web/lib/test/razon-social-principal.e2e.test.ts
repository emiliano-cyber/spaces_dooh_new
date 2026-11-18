import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  La razón social de la empresa ES una de «Razones sociales».
// ----------------------------------------------------------------------------
//  Hasta el 12/10 vivía dos veces sin conexión: texto libre en
//  `tenants.razon_social` (Administración → Identidad) y filas en
//  `entidades_fiscales`. Agregar o renombrar una en la lista no se veía en
//  Identidad. `20261012_razon_social_principal.sql` añade
//  `tenants.entidad_principal_id` y la razón social y el RFC se LEEN de ahí.
//
//  Lo que se demuestra aquí, contra Postgres real y el servidor real:
//    1. el espejo: renombrar la entidad cambia lo que dice Identidad;
//    2. elegir otra, y que no se pueda elegir la de otra organización ni una
//       dada de baja;
//    3. el RFC de «Datos fiscales» se escribe en la entidad, no aparte;
//    4. la principal no se da de baja;
//    5. el traslado de la migración, incluida su idempotencia.
// ============================================================================

const RAIZ = join(process.cwd(), '..', '..')
const MIGRACION = readFileSync(
  join(RAIZ, 'db', 'migrations', '20261012_razon_social_principal.sql'),
  'utf8',
)

let orgA: Awaited<ReturnType<typeof sembrarTenant>>
let orgB: Awaited<ReturnType<typeof sembrarTenant>>
let a: Cliente
let b: Cliente
let primera: string
let segunda: string
let deB: string

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  orgA = await sembrarTenant('principala')
  orgB = await sembrarTenant('principalb')
  await arrancarServidor()
  a = new Cliente()
  b = new Cliente()
  await a.entrar(orgA.usuarioEmail, PASSWORD_DEMO)
  await b.entrar(orgB.usuarioEmail, PASSWORD_DEMO)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

const config = async (cli: Cliente) => (await cli.pedir('/api/config/')).datos
const parchear = (cli: Cliente, cuerpo: Record<string, unknown>) =>
  cli.pedir('/api/config/', { metodo: 'PATCH', cuerpo })
const alta = async (cli: Cliente, cuerpo: Record<string, unknown>) => {
  const r = await cli.pedir('/api/entidades/', { cuerpo })
  expect(r.status, JSON.stringify(r.datos)).toBe(201)
  return r.datos.id as string
}
const principalEnBase = async (tenantId: string) =>
  (
    await poolTest().query('select entidad_principal_id from tenants where id = $1', [tenantId])
  ).rows[0].entidad_principal_id as string | null

describe('1 · el esquema', () => {
  it('la FK es compuesta con el id de la organización', async () => {
    const { rows } = await poolTest().query(
      `select pg_get_constraintdef(oid) as def from pg_constraint
        where conname = 'tenants_entidad_principal_fkey'`,
    )
    expect(rows[0]?.def).toMatch(/FOREIGN KEY \(entidad_principal_id, id\)/)
    expect(rows[0]?.def).toMatch(/entidades_fiscales\(id, tenant_id\)/)
  })

  it('ni con SQL a mano una organización apunta a la razón social de otra', async () => {
    const ajena = await poolTest().query(
      `insert into entidades_fiscales (razon_social, tenant_id) values ('Ajena SA de CV', $1) returning id`,
      [orgB.id],
    )
    await expect(
      poolTest().query('update tenants set entidad_principal_id = $1 where id = $2', [
        ajena.rows[0].id,
        orgA.id,
      ]),
    ).rejects.toThrow(/tenants_entidad_principal_fkey/)
  })
})

describe('2 · el espejo entre Identidad y Razones sociales', () => {
  it('la PRIMERA que se agrega pasa a ser la de la empresa', async () => {
    primera = await alta(a, { razonSocial: 'Primera del Centro SA de CV', rfc: 'PCE140101AB1' })
    expect(await principalEnBase(orgA.id)).toBe(primera)
    const cfg = await config(a)
    expect(cfg.entidadPrincipalId).toBe(primera)
    expect(cfg.razonSocial).toBe('Primera del Centro SA de CV')
    expect(cfg.rfc).toBe('PCE140101AB1')
  })

  it('renombrarla en Razones sociales la renombra en Identidad', async () => {
    const r = await a.pedir(`/api/entidades/${primera}/`, {
      metodo: 'PATCH',
      cuerpo: { razonSocial: 'Primera Renombrada SA de CV' },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect((await config(a)).razonSocial).toBe('Primera Renombrada SA de CV')
  })

  it('agregar otra NO cambia la principal', async () => {
    segunda = await alta(a, { razonSocial: 'Segunda Comercial SA de CV' })
    expect(await principalEnBase(orgA.id)).toBe(primera)
  })

  it('elegir otra en Identidad cambia la razón social y el RFC', async () => {
    const r = await parchear(a, { entidadPrincipalId: segunda })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.razonSocial).toBe('Segunda Comercial SA de CV')
    // Sin RFC en la entidad, Identidad dice «sin RFC»: no mezcla el de otra.
    expect(r.datos.rfc).toBeNull()
  })

  it('la razón social ya no se escribe como texto', async () => {
    const r = await parchear(a, { razonSocial: 'Escrita a mano SA de CV' })
    expect(r.status).toBe(400)
    expect((await config(a)).razonSocial).toBe('Segunda Comercial SA de CV')
  })
})

describe('3 · el RFC de «Datos fiscales» es el de la entidad principal', () => {
  it('se escribe en la entidad y no en tenants', async () => {
    const antes = (await poolTest().query('select rfc from tenants where id = $1', [orgA.id]))
      .rows[0].rfc
    const r = await parchear(a, { rfc: 'sco 140101 ab1' })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.rfc).toBe('SCO140101AB1')
    const ent = await poolTest().query('select rfc from entidades_fiscales where id = $1', [segunda])
    expect(ent.rows[0].rfc).toBe('SCO140101AB1')
    const t = await poolTest().query('select rfc from tenants where id = $1', [orgA.id])
    expect(t.rows[0].rfc).toBe(antes)
  })
})

describe('4 · lo que no se puede elegir ni apagar', () => {
  it('la de OTRA organización da 400 y deja la principal como estaba', async () => {
    deB = await alta(b, { razonSocial: 'Solo de B SA de CV' })
    const r = await parchear(a, { entidadPrincipalId: deB })
    expect(r.status).toBe(400)
    expect(await principalEnBase(orgA.id)).toBe(segunda)
  })

  it('una dada de baja da 400', async () => {
    const r = await a.pedir(`/api/entidades/${primera}/`, { metodo: 'DELETE' })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    const e = await parchear(a, { entidadPrincipalId: primera })
    expect(e.status).toBe(400)
    expect(await principalEnBase(orgA.id)).toBe(segunda)
  })

  it('la principal no se da de baja: ni con DELETE ni con activo=false', async () => {
    const d = await a.pedir(`/api/entidades/${segunda}/`, { metodo: 'DELETE' })
    expect(d.status).toBe(409)
    const p = await a.pedir(`/api/entidades/${segunda}/`, {
      metodo: 'PATCH',
      cuerpo: { activo: false },
    })
    expect(p.status).toBe(409)
    const fila = await poolTest().query('select activo from entidades_fiscales where id = $1', [
      segunda,
    ])
    expect(fila.rows[0].activo).toBe(true)
  })

  it('B no ve la principal de A en su configuración', async () => {
    const cfgB = await config(b)
    expect(cfgB.entidadPrincipalId).toBe(deB)
    expect(cfgB.razonSocial).toBe('Solo de B SA de CV')
  })
})

describe('5 · el traslado de la migración', () => {
  // `sembrarTenant` escribe `tenants.razon_social` DESPUÉS de las migraciones,
  // así que estas organizaciones están exactamente como las encontraría la
  // migración en una base de antes. Se vuelve a correr el archivo tal cual.
  let conTexto: string
  let coincide: string
  let entidadVieja: string
  let unaSola: string
  let unaSolaEnt: string
  let dos: string

  beforeAll(async () => {
    const p = poolTest()
    conTexto = (await sembrarTenant('traslado1')).id
    await p.query(`update tenants set rfc = 'tra 140101-ab1' where id = $1`, [conTexto])

    coincide = (await sembrarTenant('traslado2')).id
    await p.query(`update tenants set razon_social = 'Coincide SA de CV', rfc = 'COI140101AB1' where id = $1`, [coincide])
    entidadVieja = (
      await p.query(
        `insert into entidades_fiscales (razon_social, tenant_id, activo)
         values ('  coincide sa de cv ', $1, false) returning id`,
        [coincide],
      )
    ).rows[0].id

    unaSola = (await sembrarTenant('traslado3')).id
    await p.query('update tenants set razon_social = null where id = $1', [unaSola])
    unaSolaEnt = (
      await p.query(
        `insert into entidades_fiscales (razon_social, tenant_id) values ('Unica SA de CV', $1) returning id`,
        [unaSola],
      )
    ).rows[0].id

    dos = (await sembrarTenant('traslado4')).id
    await p.query('update tenants set razon_social = null where id = $1', [dos])
    await p.query(
      `insert into entidades_fiscales (razon_social, tenant_id)
       values ('Una SA de CV', $1), ('Otra SA de CV', $1)`,
      [dos],
    )

    await p.query(MIGRACION)
  })

  it('con texto y sin entidad: la agrega a la lista con el RFC saneado', async () => {
    const id = await principalEnBase(conTexto)
    const e = await poolTest().query(
      'select razon_social, rfc, tenant_id from entidades_fiscales where id = $1',
      [id],
    )
    expect(e.rows[0]).toEqual({
      razon_social: 'Org TRASLADO1 SA de CV',
      rfc: 'TRA140101AB1',
      tenant_id: conTexto,
    })
  })

  it('con texto que ya está en la lista: la usa, la reactiva y le pasa el RFC', async () => {
    expect(await principalEnBase(coincide)).toBe(entidadVieja)
    const e = await poolTest().query('select activo, rfc from entidades_fiscales where id = $1', [
      entidadVieja,
    ])
    expect(e.rows[0]).toEqual({ activo: true, rfc: 'COI140101AB1' })
    const n = await poolTest().query(
      'select count(*)::int n from entidades_fiscales where tenant_id = $1',
      [coincide],
    )
    expect(n.rows[0].n).toBe(1)
  })

  it('sin texto y con UNA sola activa: ésa', async () => {
    expect(await principalEnBase(unaSola)).toBe(unaSolaEnt)
  })

  it('sin texto y con DOS: no adivina', async () => {
    expect(await principalEnBase(dos)).toBeNull()
  })

  it('no toca a quien ya tenía principal', async () => {
    expect(await principalEnBase(orgA.id)).toBe(segunda)
  })

  it('correrla otra vez no agrega nada', async () => {
    const antes = await poolTest().query('select count(*)::int n from entidades_fiscales')
    await poolTest().query(MIGRACION)
    const despues = await poolTest().query('select count(*)::int n from entidades_fiscales')
    expect(despues.rows[0].n).toBe(antes.rows[0].n)
  })
})
