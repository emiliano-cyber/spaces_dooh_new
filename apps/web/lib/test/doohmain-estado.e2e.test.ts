import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  El creativo EN DOOHmain: estado, pausa y el historial por pantalla (29/10).
// ----------------------------------------------------------------------------
//  Las tres rutas leen las tablas del SDK (`doohmain_remote_campaigns`,
//  `doohmain_remote_lists`), que NO tienen RLS: el tenant se filtra a mano por
//  `creatividades`. Las unitarias simulan la base y no pueden ver si ese filtro
//  existe de verdad, así que aquí se mira con dos organizaciones reales.
//
//  El arnés corre con un intérprete de Python que no existe (`servidor-e2e.ts`):
//  toda llamada al SDK falla al arrancar. Eso es justo lo que permite ver si una
//  petición LLEGÓ al SDK (502 / error guardado) o se cortó antes (404 / 409).
// ============================================================================

let a: Awaited<ReturnType<typeof sembrarTenant>>
let b: Awaited<ReturnType<typeof sembrarTenant>>
let ca: Cliente
let cb: Cliente
let campanaA: string
let publicadoA: string
let sinPublicarA: string

async function campana(org: typeof a) {
  const r = await poolTest().query(
    `insert into campanas (nombre, cliente_id, tipo_campana, fecha_inicio, fecha_fin, estado_comercial, tenant_id)
     values ('Campaña DOOHmain',$1,'DOOH',$2,$3,'CONFIRMADA',$4) returning id`,
    [org.clienteId, enDias(-5), enDias(30), org.id],
  )
  return r.rows[0].id as string
}

async function creativo(org: typeof a, campanaId: string, nombre: string) {
  const r = await poolTest().query(
    `insert into creatividades (campana_id, nombre, archivo_url, formato, estatus_validacion, tenant_id)
     values ($1,$2,'data:image/png;base64,iVBORw0KGgo=','png','VALIDADA',$3) returning id`,
    [campanaId, nombre, org.id],
  )
  return r.rows[0].id as string
}

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  a = await sembrarTenant('dooh-a')
  b = await sembrarTenant('dooh-b')
  campanaA = await campana(a)
  publicadoA = await creativo(a, campanaA, 'Pieza publicada')
  sinPublicarA = await creativo(a, campanaA, 'Pieza sin publicar')
  // Lo que el SDK deja escrito al publicar (`doohmain_sdk/db.py`).
  await poolTest().query(
    `insert into doohmain_remote_campaigns (version, auth, name, anunciante) values ($1,'AUTH-A','x','y')`,
    [publicadoA],
  )
  await poolTest().query(
    `insert into doohmain_remote_lists (screen_name, list_name, campaign_auth, media_id)
     values ('DM-REFORMA-01','PR-1','AUTH-A',1), ('DM-PERIFERICO-02','PR-1','AUTH-A',1)`,
  )
  await arrancarServidor()
  ca = new Cliente()
  await ca.entrar(a.usuarioEmail, PASSWORD_DEMO)
  cb = new Cliente()
  await cb.entrar(b.usuarioEmail, PASSWORD_DEMO)
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

describe('GET /api/campanas/[id]/doohmain-estado', () => {
  it('la dueña ve su creativo publicado con sus pantallas; el estado, sin confirmar', async () => {
    const r = await ca.pedir(`/api/campanas/${campanaA}/doohmain-estado/`)
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.creativos).toHaveLength(1)
    expect(r.datos.creativos[0]).toMatchObject({
      creativoId: publicadoA,
      auth: 'AUTH-A',
      pantallas: ['DM-PERIFERICO-02', 'DM-REFORMA-01'],
      // El SDK no arranca: no se inventa «al aire».
      estado: null,
    })
    expect(r.datos.error).toBeTruthy()
  })

  it('otra organización con el id de esa campaña no ve nada', async () => {
    const r = await cb.pedir(`/api/campanas/${campanaA}/doohmain-estado/`)
    expect(r.status).toBe(200)
    expect(r.datos.creativos).toEqual([])
  })
})

describe('POST /api/creatividades/[id]/doohmain', () => {
  const pausar = (c: Cliente, id: string, accion: unknown = 'pausar') =>
    c.pedir(`/api/creatividades/${id}/doohmain/`, { metodo: 'POST', cuerpo: { accion } })

  it('con el creativo de otra organización: 404, y no llega a DOOHmain', async () => {
    const r = await pausar(cb, publicadoA)
    expect(r.status).toBe(404)
  })

  it('una acción que no es pausar ni reanudar: 400 — `finished` no tiene vuelta', async () => {
    expect((await pausar(ca, publicadoA, 'finalizar')).status).toBe(400)
    expect((await pausar(ca, publicadoA, 'finished')).status).toBe(400)
  })

  it('un creativo que nunca se publicó: 409, sin llamar a DOOHmain', async () => {
    const r = await pausar(ca, sinPublicarA)
    expect(r.status).toBe(409)
    expect(r.datos.error).toMatch(/no está publicado/)
  })

  it('el propio y publicado SÍ llega al SDK (aquí falla porque no hay Python): 502 honesto', async () => {
    const r = await pausar(ca, publicadoA)
    expect(r.status).toBe(502)
    expect(r.datos.error).toMatch(/Revisa su estado/)
    // Y el registro del SDK sigue ahí: pausar no es retirar.
    const n = await poolTest().query(`select 1 from doohmain_remote_campaigns where version = $1`, [publicadoA])
    expect(n.rowCount).toBe(1)
  })
})

describe('POST /api/campanas/[id]/playlogs con tipo pantallas', () => {
  const consultar = (c: Cliente) =>
    c.pedir(`/api/campanas/${campanaA}/playlogs/`, {
      metodo: 'POST',
      cuerpo: { desde: enDias(-5), hasta: enDias(0), tipo: 'pantallas' },
    })

  it('otra organización no encuentra pantallas de esa campaña: 409', async () => {
    expect((await consultar(cb)).status).toBe(409)
  })

  it('la dueña consulta las pantallas donde se publicó, y se guarda como `metrics`', async () => {
    const r = await consultar(ca)
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    expect(r.datos).toMatchObject({ tipo: 'metrics', campanaId: campanaA })
    expect([...r.datos.pantallas].sort()).toEqual(['DM-PERIFERICO-02', 'DM-REFORMA-01'])
  })

  it('consultar pantallas no enciende la evidencia digital de la campaña', async () => {
    const c = await poolTest().query(`select reporte_publicacion from campanas where id = $1`, [campanaA])
    expect(c.rows[0].reporte_publicacion).toBe(false)
  })
})
