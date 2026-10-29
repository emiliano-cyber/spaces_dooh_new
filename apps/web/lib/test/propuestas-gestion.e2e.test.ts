import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  PROP-COMPLETA · gestionar una propuesta ya creada (decisiones del dueño del
//  29/10), contra Postgres y por la red:
//
//   · BORRAR — solo un BORRADOR (R5). Se lleva sus líneas y su canje, y con el
//     canje DEVUELVE el uso del cupón. Enviada o aprobada → 409.
//   · R2 en todo: una organización no borra ni toca lo de otra.
// ============================================================================

let alfa: Awaited<ReturnType<typeof sembrarTenant>>
let beta: Awaited<ReturnType<typeof sembrarTenant>>
let ca: Cliente
let cb: Cliente

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  alfa = await sembrarTenant('gesalfa')
  beta = await sembrarTenant('gesbeta')
  await arrancarServidor()
  ca = new Cliente()
  cb = new Cliente()
  await ca.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
  await cb.entrar(beta.usuarioEmail, PASSWORD_DEMO)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

async function crear(c: Cliente, sitioId: string, nombre = 'Propuesta gestion') {
  const r = await c.pedir('/api/propuestas/', {
    cuerpo: { nombre, fechaInicio: enDias(5), fechaFin: enDias(34), items: [{ sitioId, precio: 45_000 }] },
  })
  expect(r.status, JSON.stringify(r.datos)).toBe(201)
  return r.datos as { id: string; tokenPublico: string; items: { id: string; sitioId: string }[] }
}

const cuenta = async (sql: string, params: unknown[]) =>
  Number((await poolTest().query(sql, params)).rows[0].n)

describe('borrar: solo un BORRADOR', () => {
  it('un borrador se borra con sus líneas', async () => {
    const p = await crear(ca, alfa.sitioId)
    const r = await ca.pedir(`/api/propuestas/${p.id}/`, { metodo: 'DELETE' })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(await cuenta('select count(*) n from propuestas where id=$1', [p.id])).toBe(0)
    expect(await cuenta('select count(*) n from propuesta_items where propuesta_id=$1', [p.id])).toBe(0)
  })

  it('con cupón canjeado, borrarla DEVUELVE el uso', async () => {
    await poolTest().query(
      `insert into codigos_promocionales (tenant_id, codigo, descuento_pct, vigente_desde, vigente_hasta, usos_maximos)
       values ($1,'BORRA10',10,$2::date,$3::date,1)`,
      [alfa.id, enDias(-5), enDias(30)],
    )
    const p = await crear(ca, alfa.sitioId)
    const ap = await ca.pedir(`/api/propuestas/${p.id}/codigo/`, { cuerpo: { codigo: 'BORRA10' } })
    expect(ap.status, JSON.stringify(ap.datos)).toBe(200)
    const usos = () =>
      cuenta(
        `select count(*) n from canjes_codigo k join codigos_promocionales c on c.id = k.codigo_id
          where c.codigo = 'BORRA10' and c.tenant_id = $1`,
        [alfa.id],
      )
    expect(await usos()).toBe(1)

    expect((await ca.pedir(`/api/propuestas/${p.id}/`, { metodo: 'DELETE' })).status).toBe(200)
    expect(await usos()).toBe(0)

    // Y el uso devuelto se puede gastar: el cupón tenía tope de UNO.
    const otra = await crear(ca, alfa.sitioId)
    const de = await ca.pedir(`/api/propuestas/${otra.id}/codigo/`, { cuerpo: { codigo: 'BORRA10' } })
    expect(de.status, JSON.stringify(de.datos)).toBe(200)
  })

  it('NEGATIVO · una ENVIADA no se borra (409) y sigue ahí', async () => {
    const p = await crear(ca, alfa.sitioId)
    await ca.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'ENVIADA' } })
    const r = await ca.pedir(`/api/propuestas/${p.id}/`, { metodo: 'DELETE' })
    expect(r.status).toBe(409)
    expect(r.datos.error).toMatch(/rechaza/)
    expect(await cuenta('select count(*) n from propuestas where id=$1', [p.id])).toBe(1)
  })

  it('NEGATIVO · una APROBADA tampoco', async () => {
    const p = await crear(ca, alfa.sitioId)
    await ca.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'APROBADA' } })
    expect((await ca.pedir(`/api/propuestas/${p.id}/`, { metodo: 'DELETE' })).status).toBe(409)
  })

  it('R2 · beta no borra un borrador de alfa: 404, y sigue ahí', async () => {
    const p = await crear(ca, alfa.sitioId)
    const r = await cb.pedir(`/api/propuestas/${p.id}/`, { metodo: 'DELETE' })
    expect(r.status).toBe(404)
    expect(await cuenta('select count(*) n from propuestas where id=$1', [p.id])).toBe(1)
  })
})
