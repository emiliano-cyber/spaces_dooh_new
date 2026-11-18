import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomBytes } from 'node:crypto'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente, BASE } from './servidor-e2e'

// ============================================================================
//  FOTOS-UBIC · «ver fotos de la pantalla y lugar» en la LIGA PÚBLICA de la
//  propuesta (`GET /api/propuestas/publica/<token>/sitios/<sitioId>`), contra
//  Postgres y Next reales (18/11).
//
//   · El token de la propuesta enseña las fotos y la ubicación de SUS sitios.
//   · R2 (negativos): un sitio de la misma organización que NO está en la
//     propuesta no sale; el token de otra organización no ve los sitios de
//     ésta (ni al revés); un token inventado o mal formado da 404.
//   · Nada de arrendador, predio, renta, tarifa ni costo en la respuesta: se
//     busca en el TEXTO CRUDO, no en un campo.
//   · Y la ruta interna `/api/sitios/:id/media` sigue cerrada sin sesión: la
//     liga no se resolvió abriéndola.
// ============================================================================

const FOTO_A1 = 'data:image/png;base64,QUxGQS1QQU5UQUxMQS0x'
const FOTO_A2 = 'data:image/jpeg;base64,QUxGQS1MVUdBUi0y'
const FOTO_FUERA = 'data:image/png;base64,RlVFUkEtREUtTEEtUFJPUFVFU1RB'
const FOTO_BETA = 'data:image/png;base64,QkVUQS1TRUNSRVRB'

let alfa: Awaited<ReturnType<typeof sembrarTenant>>
let beta: Awaited<ReturnType<typeof sembrarTenant>>
let sitioFuera: string
let tokenAlfa: string
let tokenBeta: string
let dueno: Cliente
let duenoBeta: Cliente

async function sitioPublico(token: string, sitioId: string) {
  const r = await fetch(`${BASE}/api/propuestas/publica/${token}/sitios/${sitioId}/`)
  const texto = await r.text()
  let datos: any = null
  try {
    datos = JSON.parse(texto)
  } catch {
    datos = texto
  }
  return { status: r.status, datos, texto }
}

async function crearPropuesta(c: Cliente, org: Awaited<ReturnType<typeof sembrarTenant>>, nombre: string) {
  const r = await c.pedir('/api/propuestas/', {
    cuerpo: {
      clienteId: org.clienteId,
      nombre,
      fechaInicio: enDias(7),
      fechaFin: enDias(37),
      items: [
        {
          sitioId: org.sitioId,
          precio: 45000,
          unidad: 'mensual',
          tarifaUnitaria: 45000,
          cantidad: 1,
          rentaMonto: 20000,
          rentaPeriodicidad: 'MENSUAL',
          rentaInicio: enDias(0),
        },
      ],
    },
  })
  expect(r.status, JSON.stringify(r.datos)).toBe(201)
  return r.datos.tokenPublico as string
}

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  alfa = await sembrarTenant('fotalfa')
  beta = await sembrarTenant('fotbeta')
  const p = poolTest()
  await p.query(
    `update sitios set fotos = $2, imagen_promocional = $3, direccion = 'Av. Insurgentes Sur 1000',
            estado = 'Ciudad de México', lat = 19.39, lng = -99.17
      where id = $1`,
    [alfa.sitioId, [FOTO_A1, FOTO_A2], FOTO_A1],
  )
  await p.query(`update sitios set fotos = $2, direccion = 'Calle Secreta de Beta 7' where id = $1`, [
    beta.sitioId,
    [FOTO_BETA],
  ])
  // Otro sitio de ALFA, con fotos, que NO entra en la propuesta.
  const fuera = await p.query(
    `insert into sitios (nombre, clave_interna, codigo_proveedor, tipo_medio, estatus_comercial,
                         alcaldia, ciudad, tarifa_publicada, tarifa_mensual, tenant_id, exhibicion, fotos, direccion)
     values ('Pantalla Fuera de la Propuesta', 'FOTALFA-002', 'FOTALFA-PROV-002', 'PANTALLA_DIGITAL', 'DISPONIBLE',
             'Miguel Hidalgo', 'CDMX', 30000, 30000, $1, 'digital', $2, 'Calle Fuera 9')
     returning id`,
    [alfa.id, [FOTO_FUERA]],
  )
  sitioFuera = fuera.rows[0].id

  await arrancarServidor()
  dueno = new Cliente()
  duenoBeta = new Cliente()
  await dueno.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
  await duenoBeta.entrar(beta.usuarioEmail, PASSWORD_DEMO)
  tokenAlfa = await crearPropuesta(dueno, alfa, 'Propuesta con fotos Alfa')
  tokenBeta = await crearPropuesta(duenoBeta, beta, 'Propuesta SECRETA Beta')
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

describe('1 · la liga enseña las fotos y la ubicación de SUS pantallas', () => {
  it('el payload público trae el sitioId de cada renglón, para pedir sus fotos', async () => {
    const r = await fetch(`${BASE}/api/propuestas/publica/${tokenAlfa}/`)
    expect(r.status).toBe(200)
    const d = await r.json()
    expect(d.items.map((i: any) => i.sitioId)).toEqual([alfa.sitioId])
    // Y el payload de la liga sigue SIN fotos: pesan cientos de kB y van aparte.
    expect(JSON.stringify(d)).not.toContain(FOTO_A1)
  })

  it('token + sitio de la propuesta: 200 con fotos, dirección, zona y coordenadas', async () => {
    const r = await sitioPublico(tokenAlfa, alfa.sitioId)
    expect(r.status, r.texto).toBe(200)
    expect(r.datos).toEqual({
      nombre: 'Pantalla fotalfa',
      tipoMedio: 'PANTALLA_DIGITAL',
      direccion: 'Av. Insurgentes Sur 1000',
      alcaldia: 'Cuauhtémoc',
      ciudad: 'CDMX',
      estado: 'Ciudad de México',
      lat: 19.39,
      lng: -99.17,
      fotos: [FOTO_A1, FOTO_A2],
    })
  })

  it('NEGATIVO · nada de arrendador, predio, renta, tarifa, costo ni claves internas en el texto crudo', async () => {
    const r = await sitioPublico(tokenAlfa, alfa.sitioId)
    expect(r.texto).not.toMatch(/Arrendador|Predio|FOTALFA-|20000|45000|30000/)
    expect(r.texto).not.toMatch(/renta|tarifa|costo|precio|arrendador|predio|clave/i)
  })

  it('el token de beta ve SU pantalla', async () => {
    const r = await sitioPublico(tokenBeta, beta.sitioId)
    expect(r.status).toBe(200)
    expect(r.datos.fotos).toEqual([FOTO_BETA])
  })
})

describe('2 · R2 · lo que la liga NO enseña', () => {
  it('NEGATIVO · un sitio de la MISMA organización que no está en la propuesta: 404 y sin sus fotos', async () => {
    const r = await sitioPublico(tokenAlfa, sitioFuera)
    expect(r.status).toBe(404)
    expect(r.texto).not.toContain(FOTO_FUERA)
    expect(r.texto).not.toContain('Calle Fuera')
  })

  it('NEGATIVO · el token de alfa no ve la pantalla de beta, ni el de beta las de alfa', async () => {
    const a = await sitioPublico(tokenAlfa, beta.sitioId)
    expect(a.status).toBe(404)
    expect(a.texto).not.toContain(FOTO_BETA)
    expect(a.texto).not.toContain('Secreta')
    for (const s of [alfa.sitioId, sitioFuera]) {
      const b = await sitioPublico(tokenBeta, s)
      expect(b.status).toBe(404)
      expect(b.texto).not.toContain(FOTO_A1)
      expect(b.texto).not.toContain(FOTO_FUERA)
    }
  })

  it('NEGATIVO · un token inventado de 48 hex, uno mal formado y un sitio mal formado: 404', async () => {
    const inventado = randomBytes(24).toString('hex')
    const r = await sitioPublico(inventado, alfa.sitioId)
    expect(r.status).toBe(404)
    expect(r.texto).not.toContain(FOTO_A1)
    expect((await sitioPublico('abc', alfa.sitioId)).status).toBe(404)
    expect((await sitioPublico(`${tokenAlfa}'--`, alfa.sitioId)).status).toBe(404)
    expect((await sitioPublico(tokenAlfa, 'no-es-uuid')).status).toBe(404)
  })

  it('NEGATIVO · la galería interna sigue exigiendo sesión (no se abrió /api/sitios para la liga)', async () => {
    const r = await fetch(`${BASE}/api/sitios/${alfa.sitioId}/media/`)
    expect([401, 403]).toContain(r.status)
    expect(await r.text()).not.toContain(FOTO_A1)
  })

  it('con sesión, la ficha interna sigue leyendo la galería por /api/sitios/:id/media', async () => {
    const r = await dueno.pedir(`/api/sitios/${alfa.sitioId}/media/`)
    expect(r.status).toBe(200)
    expect(r.datos.fotos).toEqual([FOTO_A1, FOTO_A2])
  })
})
