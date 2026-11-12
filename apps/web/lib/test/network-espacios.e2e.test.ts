import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { asegurarPermisos, sembrarTenant, type TenantSembrado } from './semillas-e2e'
import { arrancarServidor, pararServidor, BASE } from './servidor-e2e'

// ============================================================================
//  GET /api/network/espacios — lo que la nueva app de Network sincroniza.
//  Decidido por el dueño el 11/11: la app consulta; ve ficha pública + días
//  libres de cada pantalla con el switch «En la Network» encendido.
//
//  Es e2e y no unitaria porque el riesgo es de RLS: la ruta no tiene sesión,
//  `sitios` y `reservas` son fail-closed, y un `qRaw` aquí devolvería CERO
//  pantallas sin un solo error. Una unitaria con la base simulada no lo ve.
//
//  Los casos negativos son los que importan:
//   · sin token, con token equivocado → 401 y nada del inventario;
//   · el switch APAGADO saca la pantalla de la lista y de la foto;
//   · los datos internos (costo, tarifa mensual, notas, campaña, cliente)
//     no salen — se afirman las claves EXACTAS de cada espacio.
// ============================================================================

const TOKEN = 'token-de-network-para-pruebas'
const FOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

let alfa: TenantSembrado
let beta: TenantSembrado
let estaticaAlfa: string
let ip = 10
async function pedir(ruta: string, token?: string) {
  const h: Record<string, string> = { 'x-forwarded-for': `10.9.7.${ip++}` }
  if (token !== undefined) h['x-network-token'] = token
  return fetch(`${BASE}${ruta}`, { headers: h, redirect: 'manual' })
}

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  alfa = await sembrarTenant('netalfa')
  beta = await sembrarTenant('netbeta')
  const p = poolTest()

  // La digital de alfa (12 spots) va a la Network con foto y notas internas.
  await p.query(
    `update sitios set en_network = true, costo_compra = 999, notas = 'NOTA INTERNA', fotos = array[$2]
      where id = $1`,
    [alfa.sitioId, FOTO],
  )
  // Una estática de alfa en la Network, con una reserva del 2027-01-10 al 20.
  estaticaAlfa = (
    await p.query(
      `insert into sitios (nombre, clave_interna, tipo_medio, tenant_id, en_network, tarifa_publicada)
       values ('Espectacular alfa','NETALFA-EST','ESPECTACULAR',$1,true,30000) returning id`,
      [alfa.id],
    )
  ).rows[0].id
  const camp = (
    await p.query(
      `insert into campanas (folio, nombre, cliente_id, fecha_inicio, fecha_fin, tenant_id)
       values ('CAM-NET-1','Campaña secreta',$1,'2027-01-10','2027-01-20',$2) returning id`,
      [alfa.clienteId, alfa.id],
    )
  ).rows[0].id
  await p.query(
    `insert into reservas (campana_id, sitio_id, fecha_inicio, fecha_fin, precio, estatus, tenant_id)
     values ($1,$2,'2027-01-10','2027-01-20',123456,'CONFIRMADA',$3)`,
    [camp, estaticaAlfa, alfa.id],
  )
  // Una reserva CANCELADA no ocupa, igual que en el alta.
  await p.query(
    `insert into reservas (campana_id, sitio_id, fecha_inicio, fecha_fin, precio, estatus, tenant_id)
     values ($1,$2,'2027-01-25','2027-01-28',1,'CANCELADA',$3)`,
    [camp, estaticaAlfa, alfa.id],
  )
  // La pantalla de beta tiene el switch APAGADO (lo de fábrica).

  process.env.NETWORK_TOKEN = TOKEN
  await arrancarServidor()
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

describe('la puerta: solo la app con su token', () => {
  it('sin token → 401 y ni una pantalla', async () => {
    const r = await pedir('/api/network/espacios/')
    expect(r.status).toBe(401)
    expect(JSON.stringify(await r.json())).not.toContain('Pantalla')
  })

  it('con un token equivocado → 401', async () => {
    expect((await pedir('/api/network/espacios/', 'otro-token')).status).toBe(401)
  })

  it('la foto también está cerrada sin token', async () => {
    expect((await pedir(`/api/network/espacios/${alfa.sitioId}/foto/`)).status).toBe(401)
  })
})

describe('con token, la app ve lo que tiene el switch encendido', () => {
  it('lista las dos de alfa, de dos organizaciones leídas bajo su RLS, y NO la de beta (switch apagado)', async () => {
    const r = await pedir('/api/network/espacios/?desde=2027-01-01&hasta=2027-01-31', TOKEN)
    expect(r.status).toBe(200)
    expect(r.headers.get('cache-control')).toContain('no-store')
    const d = await r.json()
    const ids = d.espacios.map((e: any) => e.id).sort()
    expect(ids).toEqual([alfa.sitioId, estaticaAlfa].sort())
    expect(ids).not.toContain(beta.sitioId)
  })

  it('encender el switch de beta la hace aparecer en la siguiente consulta', async () => {
    await poolTest().query('update sitios set en_network = true where id = $1', [beta.sitioId])
    const d = await (await pedir('/api/network/espacios/?desde=2027-01-01&hasta=2027-01-31', TOKEN)).json()
    const e = d.espacios.find((x: any) => x.id === beta.sitioId)
    expect(e?.organizacionId).toBe(beta.id)
    await poolTest().query('update sitios set en_network = false where id = $1', [beta.sitioId])
  })

  it('cada espacio trae EXACTAMENTE la ficha pública: ni costo, ni tarifa mensual, ni notas', async () => {
    const d = await (await pedir('/api/network/espacios/?desde=2027-01-01&hasta=2027-01-31', TOKEN)).json()
    const e = d.espacios.find((x: any) => x.id === alfa.sitioId)
    expect(Object.keys(e).sort()).toEqual(
      [
        'actualizadoEn', 'alto', 'ancho', 'caras', 'ciudad', 'codigo', 'comercializacion', 'direccion',
        'disponibilidad', 'duracionSpotSeg', 'estado', 'horario', 'id', 'iluminado', 'lat', 'lng',
        'modalidades', 'moneda', 'nombre', 'organizacionId', 'orientacion', 'pais', 'resolucionPx',
        'spotsPorHora', 'tarifaPublicada', 'tieneFoto', 'tipoMedio', 'totalSpots',
      ].sort(),
    )
    const texto = JSON.stringify(d)
    expect(texto).not.toContain('NOTA INTERNA')
    expect(texto).not.toContain('Campaña secreta')
    expect(texto).not.toContain('123456')
    expect(e.tieneFoto).toBe(true)
    expect(e.tarifaPublicada).toBe(45000)
  })

  it('la estática reservada del 10 al 20 publica libres el 1–9 y el 21–31 (la cancelada no ocupa)', async () => {
    const d = await (await pedir('/api/network/espacios/?desde=2027-01-01&hasta=2027-01-31', TOKEN)).json()
    const e = d.espacios.find((x: any) => x.id === estaticaAlfa)
    expect(e.disponibilidad.libres).toEqual([
      { desde: '2027-01-01', hasta: '2027-01-09' },
      { desde: '2027-01-21', hasta: '2027-01-31' },
    ])
  })

  it('un rango mal formado o de más de 366 días → 400', async () => {
    expect((await pedir('/api/network/espacios/?desde=2027-13-01', TOKEN)).status).toBe(400)
    expect((await pedir('/api/network/espacios/?desde=2027-01-01&hasta=2028-06-01', TOKEN)).status).toBe(400)
  })
})

describe('la foto', () => {
  it('devuelve los bytes de la imagen de una pantalla en la Network', async () => {
    const r = await pedir(`/api/network/espacios/${alfa.sitioId}/foto/`, TOKEN)
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toBe('image/png')
    expect((await r.arrayBuffer()).byteLength).toBeGreaterThan(20)
  })

  it('con el switch apagado da 404, igual que un id que no existe', async () => {
    await poolTest().query('update sitios set fotos = array[$2] where id = $1', [beta.sitioId, FOTO])
    expect((await pedir(`/api/network/espacios/${beta.sitioId}/foto/`, TOKEN)).status).toBe(404)
    expect((await pedir('/api/network/espacios/00000000-0000-0000-0000-000000000000/foto/', TOKEN)).status).toBe(404)
  })
})
