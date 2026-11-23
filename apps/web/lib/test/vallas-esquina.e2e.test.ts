import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest, poolApp } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  VALLAS · LA ESQUINA (dueño, 20/11) · contra Postgres y Next reales.
// ----------------------------------------------------------------------------
//  «Hay vallas que están en esquinas y doblan a la derecha o izquierda.»
//  `vallas.dobla` (migración `20261120_vallas_esquina.sql`): después de esta
//  valla la pared dobla, 'izquierda' | 'derecha' | null.
//
//   1. La migración está aplicada: la columna y su CHECK con nombre, que
//      rechaza en la base un valor que no sea izquierda/derecha.
//   2. Alta y edición con `dobla` por la API; editar otra cosa no la borra;
//      null la quita. Un valor inválido es 400.
//   3. Aislamiento: la otra organización no edita la esquina de esta (404) ni
//      la ve; con el rol de la app y sin tenant, cero filas.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let otra: Awaited<ReturnType<typeof sembrarTenant>>
let dueno: Cliente
let duenoOtra: Cliente

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('esquina-org')
  otra = await sembrarTenant('esquina-otra')
  await arrancarServidor()
  dueno = new Cliente()
  await dueno.entrar(org.usuarioEmail, PASSWORD_DEMO)
  duenoOtra = new Cliente()
  await duenoOtra.entrar(otra.usuarioEmail, PASSWORD_DEMO)
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

beforeEach(async () => {
  await poolTest().query('delete from vallas')
})

const alta = (c: Cliente, cuerpo: Record<string, unknown>) => c.pedir('/api/vallas/', { cuerpo })
const editar = (c: Cliente, id: string, cuerpo: Record<string, unknown>) =>
  c.pedir(`/api/vallas/${id}/`, { metodo: 'PATCH', cuerpo })

describe('la migración de la esquina', () => {
  it('deja la columna `dobla` y el CHECK `vallas_dobla_ck`, que la base hace cumplir', async () => {
    const col = await poolTest().query(
      `select data_type, is_nullable from information_schema.columns where table_name = 'vallas' and column_name = 'dobla'`,
    )
    expect(col.rows).toEqual([{ data_type: 'text', is_nullable: 'YES' }])
    const ck = await poolTest().query(`select count(*)::int n from pg_constraint where conname = 'vallas_dobla_ck'`)
    expect(ck.rows[0].n).toBe(1)
    await expect(
      poolTest().query(
        `insert into vallas (tenant_id, sitio_id, numero, ancho_m, alto_m, dobla) values ($1, $2, 'X-1', 6, 3, 'arriba')`,
        [org.id, org.sitioId],
      ),
    ).rejects.toMatchObject({ code: '23514' })
  })
})

describe('alta y edición con la esquina', () => {
  it('nace doblando, se cambia, sobrevive a editar otra cosa y null la quita', async () => {
    const a = await alta(dueno, { sitioId: org.sitioId, numero: 'E-001', ancho: 6, alto: 3, dobla: 'derecha' })
    expect(a.status).toBe(201)
    expect(a.datos.dobla).toBe('derecha')

    const sin = await alta(dueno, { sitioId: org.sitioId, numero: 'E-002', ancho: 6, alto: 3 })
    expect(sin.status).toBe(201)
    expect(sin.datos.dobla).toBeNull()

    const e = await editar(dueno, a.datos.id, { dobla: 'izquierda' })
    expect(e.status).toBe(200)
    expect(e.datos.dobla).toBe('izquierda')

    const otraCosa = await editar(dueno, a.datos.id, { notas: 'Esquina con Insurgentes' })
    expect(otraCosa.datos.dobla).toBe('izquierda')

    const l = await dueno.pedir('/api/vallas/')
    expect(l.datos.vallas.map((v: { numero: string; dobla: string | null }) => [v.numero, v.dobla])).toEqual([
      ['E-001', 'izquierda'],
      ['E-002', null],
    ])

    const quitar = await editar(dueno, a.datos.id, { dobla: null })
    expect(quitar.datos.dobla).toBeNull()
  })

  it('un valor que no es izquierda/derecha es 400, en el alta y en la edición, y no escribe', async () => {
    const mala = await alta(dueno, { sitioId: org.sitioId, numero: 'E-003', ancho: 6, alto: 3, dobla: 'arriba' })
    expect(mala.status).toBe(400)
    const buena = await alta(dueno, { sitioId: org.sitioId, numero: 'E-004', ancho: 6, alto: 3 })
    const e = await editar(dueno, buena.datos.id, { dobla: 'Derecha' })
    expect(e.status).toBe(400)
    const r = await poolTest().query(`select numero, dobla from vallas order by numero`)
    expect(r.rows).toEqual([{ numero: 'E-004', dobla: null }])
  })
})

describe('aislamiento de la esquina', () => {
  it('la otra organización no la ve ni la cambia (404); con el rol de la app y sin tenant, cero filas', async () => {
    const a = await alta(dueno, { sitioId: org.sitioId, numero: 'E-010', ancho: 6, alto: 3, dobla: 'derecha' })
    expect(a.status).toBe(201)

    const ajena = await editar(duenoOtra, a.datos.id, { dobla: 'izquierda' })
    expect(ajena.status).toBe(404)
    const lista = await duenoOtra.pedir('/api/vallas/')
    expect(lista.datos.vallas).toEqual([])

    const r = await poolTest().query('select dobla from vallas where id = $1', [a.datos.id])
    expect(r.rows[0].dobla).toBe('derecha')

    const cli = await poolApp().connect()
    try {
      const sinTenant = await cli.query('select count(*)::int n from vallas where dobla is not null')
      expect(sinTenant.rows[0].n).toBe(0)
    } finally {
      cli.release()
    }
  })
})
