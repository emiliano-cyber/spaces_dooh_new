import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  Una notificación sale UNA vez como aviso emergente (08/10).
//
//  Pedido del dueño: «cuando ya aparecen en la pantalla una vez ya no deben de
//  volver a aparecer más que en el botón de notificaciones». El aviso lo pinta
//  `SondeoNotificaciones` con lo que devuelve `/api/notificaciones/nuevas`, y
//  avanza su marca `desde` al `creadoEn` de la última que recibió.
//
//  El defecto: Postgres guarda `creado_en` con MICROsegundos y `creadoEn` viaja
//  como ISO de JavaScript, con MILIsegundos. La marca queda por DEBAJO de la
//  hora real (…05.123 < …05.123456), la misma notificación vuelve a cumplir
//  `creado_en > desde`, y el aviso salía otra vez en cada sondeo (cada 15 s).
//  Solo se paraba cuando llegaba una notificación más nueva. Las unitarias no
//  lo ven: simulan la base, y la base simulada no tiene microsegundos.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let dueno: Cliente

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('notifunavez')
  await arrancarServidor()
  dueno = new Cliente()
  await dueno.entrar(org.usuarioEmail, PASSWORD_DEMO)
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

async function notificacion(titulo: string, creadoEn: string) {
  await poolTest().query(
    `insert into notificaciones (tipo, nivel, titulo, tenant_id, creado_en)
     values ('prueba', 'info', $1, $2, $3::timestamptz)`,
    [titulo, org.id, creadoEn],
  )
}
const nuevas = async (desde: string) => {
  const r = await dueno.pedir(`/api/notificaciones/nuevas/?sondeo=1&desde=${encodeURIComponent(desde)}`)
  expect(r.status).toBe(200)
  return {
    titulos: (r.datos.notificaciones as { titulo: string }[]).map((n) => n.titulo),
    creadoEn: (r.datos.notificaciones as { creadoEn: string }[]).map((n) => n.creadoEn),
    marca: r.datos.marca as string,
  }
}

describe('el sondeo de notificaciones nuevas', () => {
  it('una notificación con microsegundos NO vuelve a salir con la marca que devuelve el servidor', async () => {
    await notificacion('Primera', '2030-01-01T12:00:05.123456Z')
    const primera = await nuevas('2030-01-01T12:00:00.000Z')
    expect(primera.titulos).toEqual(['Primera'])
    expect(primera.marca).toBe('2030-01-01T12:00:05.123456Z')

    // Lo que hace SondeoNotificaciones: preguntar otra vez con esa marca.
    expect((await nuevas(primera.marca)).titulos).toEqual([])
  })

  it('el defecto, a la vista: con el creadoEn (milisegundos) como marca, la misma volvía a salir', async () => {
    const r = await nuevas('2030-01-01T12:00:00.000Z')
    expect(r.creadoEn[0]).toBe('2030-01-01T12:00:05.123Z')
    expect((await nuevas(r.creadoEn[0])).titulos).toContain('Primera')
  })

  it('NEGATIVO: una que llega después sí sale, aunque caiga en el mismo milisegundo', async () => {
    // Primera es …05.123456 y ésta …05.123789: mismo milisegundo, más tarde. Si
    // el arreglo fuera redondear la marca hacia ARRIBA, ésta no saldría nunca.
    await notificacion('Segunda', '2030-01-01T12:00:05.123789Z')
    const tras = await nuevas('2030-01-01T12:00:05.123456Z')
    expect(tras.titulos).toEqual(['Segunda'])
    expect((await nuevas(tras.marca)).titulos).toEqual([])
  })

  it('sin novedades, la marca se queda donde estaba', async () => {
    const r = await nuevas('2031-01-01T00:00:00.000Z')
    expect(r.titulos).toEqual([])
    expect(r.marca).toBe('2031-01-01T00:00:00.000Z')
  })
})
