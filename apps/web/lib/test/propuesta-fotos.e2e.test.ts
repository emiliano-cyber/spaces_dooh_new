import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  «Fotos de las pantallas» en la ficha interna de la propuesta (dueño,
//  20/11), contra Postgres y Next reales.
//
//  GET /api/propuestas/:id/fotos → { sitios: [{ sitioId, nombre, fotos }] }
//  en UNA consulta por propuesta. Lo que se demuestra es lo que IMPIDE:
//
//   1. Otra organización no ve las fotos (404), ni pidiendo el id exacto (R2).
//   2. Un rol sin `comercial.ver` → 403.
//   3. Un vendedor no ve las de la propuesta de otro vendedor → 404 (ADR 0051).
//   4. Solo sitios de la propuesta; uno sin fotos llega con `fotos: []`.
//   5. Agregar un sitio a la propuesta lo añade a la respuesta.
// ============================================================================

let alfa: Awaited<ReturnType<typeof sembrarTenant>>
let beta: Awaited<ReturnType<typeof sembrarTenant>>
let ca: Cliente
let cb: Cliente
let sitioSinFotos: string
let sitioAjeno: string
let propuesta: string

const PNG = 'data:image/png;base64,iVBORw0KGgo='
const JPG = 'data:image/jpeg;base64,/9j/4AAQ='
const correo = (q: string) => `${q}@fotosprop.test`

async function sembrarUsuario(tenantId: string, quien: string, rol: string) {
  await poolTest().query(
    `insert into usuarios (nombre, email, cargo, rol, password_hash, activo, tenant_id)
     values ($1,$2,$1,$3::rol_demo,$4,true,$5)`,
    [quien, correo(quien), rol, await bcrypt.hash(PASSWORD_DEMO, 4), tenantId],
  )
  const c = new Cliente()
  await c.entrar(correo(quien), PASSWORD_DEMO)
  return c
}

async function nuevoSitio(tenantId: string, clave: string, fotos: string[]) {
  return (
    await poolTest().query(
      `insert into sitios (nombre, clave_interna, codigo_proveedor, tipo_medio, estatus_comercial,
                           alcaldia, ciudad, tarifa_publicada, tarifa_mensual, tenant_id, exhibicion, fotos)
       values ($1,$1,$1,'ESPECTACULAR','DISPONIBLE','Tlalpan','CDMX',30000,30000,$2,'fijo',$3)
       returning id`,
      [clave, tenantId, fotos],
    )
  ).rows[0].id as string
}

// Con la tarifa de lista del sitio (`unidad` + `tarifaUnitaria`): un vendedor
// no puede apartarse de ella (403), y aquí no se mide eso.
async function crear(c: Cliente, sitioId: string, nombre = 'Propuesta fotos') {
  const r = await c.pedir('/api/propuestas/', {
    cuerpo: {
      nombre,
      fechaInicio: enDias(10),
      fechaFin: enDias(40),
      items: [{ sitioId, unidad: 'mensual', tarifaUnitaria: 45_000, cantidad: 1 }],
    },
  })
  expect(r.status, JSON.stringify(r.datos)).toBe(201)
  return r.datos.id as string
}

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  alfa = await sembrarTenant('fotalfa')
  beta = await sembrarTenant('fotbeta')
  await poolTest().query('update sitios set fotos = $1 where id = $2', [[PNG, JPG, 'javascript:alert(1)'], alfa.sitioId])
  sitioSinFotos = await nuevoSitio(alfa.id, 'FOTALFA-SIN', [])
  // Un sitio de alfa con fotos que NO está en la propuesta: no debe salir.
  sitioAjeno = await nuevoSitio(alfa.id, 'FOTALFA-OTRO', [PNG])
  await poolTest().query('update sitios set fotos = $1 where id = $2', [[JPG], beta.sitioId])
  await arrancarServidor()
  ca = new Cliente()
  cb = new Cliente()
  await ca.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
  await cb.entrar(beta.usuarioEmail, PASSWORD_DEMO)
  propuesta = await crear(ca, alfa.sitioId)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

describe('GET /api/propuestas/:id/fotos', () => {
  it('devuelve las fotos de los sitios de la propuesta, filtradas, y nada más', async () => {
    const r = await ca.pedir(`/api/propuestas/${propuesta}/fotos/`)
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos).toEqual({ sitios: [{ sitioId: alfa.sitioId, nombre: 'Pantalla fotalfa', fotos: [PNG, JPG] }] })
    expect(JSON.stringify(r.datos)).not.toContain(sitioAjeno)
  })

  it('agregar un sitio sin fotos lo añade con `fotos: []`, después del primero', async () => {
    const a = await ca.pedir(`/api/propuestas/${propuesta}/items/`, {
      cuerpo: { items: [{ sitioId: sitioSinFotos, precio: 30_000 }] },
    })
    expect(a.status, JSON.stringify(a.datos)).toBe(201)
    const r = await ca.pedir(`/api/propuestas/${propuesta}/fotos/`)
    expect(r.status).toBe(200)
    expect(r.datos.sitios.map((s: any) => [s.sitioId, s.fotos.length])).toEqual([
      [alfa.sitioId, 2],
      [sitioSinFotos, 0],
    ])
  })

  it('NEGATIVO · otra organización no ve las fotos de esta propuesta (404)', async () => {
    const r = await cb.pedir(`/api/propuestas/${propuesta}/fotos/`)
    expect(r.status).toBe(404)
    expect(JSON.stringify(r.datos)).not.toContain('data:image')
  })

  it('NEGATIVO · y su propia propuesta no enseña nada de alfa', async () => {
    const suya = await crear(cb, beta.sitioId)
    const r = await cb.pedir(`/api/propuestas/${suya}/fotos/`)
    expect(r.status).toBe(200)
    expect(r.datos.sitios).toEqual([{ sitioId: beta.sitioId, nombre: 'Pantalla fotbeta', fotos: [JPG] }])
  })

  it('NEGATIVO · un rol sin comercial.ver → 403', async () => {
    const imprenta = await sembrarUsuario(alfa.id, 'imprenta', 'IMPRENTA')
    const r = await imprenta.pedir(`/api/propuestas/${propuesta}/fotos/`)
    expect(r.status).toBe(403)
  })

  it('NEGATIVO · un vendedor no ve las fotos de la propuesta de otro (404); las suyas sí', async () => {
    const v1 = await sembrarUsuario(alfa.id, 'vend1', 'VENDEDOR')
    const v2 = await sembrarUsuario(alfa.id, 'vend2', 'VENDEDOR')
    const deV1 = await crear(v1, alfa.sitioId, 'De vend1')
    expect((await v2.pedir(`/api/propuestas/${deV1}/fotos/`)).status).toBe(404)
    const mia = await v1.pedir(`/api/propuestas/${deV1}/fotos/`)
    expect(mia.status).toBe(200)
    expect(mia.datos.sitios[0].fotos).toEqual([PNG, JPG])
  })

  it('NEGATIVO · un id que no es uuid es 404, no 500', async () => {
    expect((await ca.pedir('/api/propuestas/no-es-uuid/fotos/')).status).toBe(404)
  })
})
