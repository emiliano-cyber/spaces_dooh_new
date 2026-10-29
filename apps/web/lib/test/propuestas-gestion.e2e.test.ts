import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  PROP-COMPLETA · gestionar una propuesta ya creada (decisiones del dueño del
//  29/10), contra Postgres y por la red:
//
//   · BORRAR — solo un BORRADOR (R5). Se lleva sus líneas y su canje, y con el
//     canje DEVUELVE el uso del cupón. Enviada o aprobada → 409.
//   · AGREGAR / QUITAR sitios — en BORRADOR y ENVIADA (ENVIADA sube versión).
//     Lo agregado pasa por la MISMA tarifa del servidor que el alta (B40).
//   · R2 en todo: una organización no borra ni toca lo de otra.
// ============================================================================

let alfa: Awaited<ReturnType<typeof sembrarTenant>>
let beta: Awaited<ReturnType<typeof sembrarTenant>>
let ca: Cliente
let cb: Cliente
let cVend: Cliente
let otroSitioAlfa: string

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  alfa = await sembrarTenant('gesalfa')
  beta = await sembrarTenant('gesbeta')
  // Una segunda pantalla en alfa (tarifa 30 000) y una VENDEDORA, que no puede
  // apartarse de la tarifa calculada.
  otroSitioAlfa = (
    await poolTest().query(
      `insert into sitios (nombre, clave_interna, codigo_proveedor, tipo_medio, estatus_comercial,
                          alcaldia, ciudad, tarifa_publicada, tarifa_mensual, tenant_id, exhibicion)
       values ('Valla gesalfa 2','GESALFA-002','GESALFA-PROV-002','VALLA','DISPONIBLE','Tlalpan','CDMX',30000,30000,$1,'fijo')
       returning id`,
      [alfa.id],
    )
  ).rows[0].id
  await poolTest().query(
    `insert into usuarios (nombre, email, cargo, rol, password_hash, activo, tenant_id)
     values ('Vendedora gesalfa','vend@gesalfa.test','Ejecutiva','COMERCIAL',$1,true,$2)`,
    [await bcrypt.hash(PASSWORD_DEMO, 4), alfa.id],
  )
  await arrancarServidor()
  ca = new Cliente()
  cb = new Cliente()
  cVend = new Cliente()
  await ca.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
  await cb.entrar(beta.usuarioEmail, PASSWORD_DEMO)
  await cVend.entrar('vend@gesalfa.test', PASSWORD_DEMO)
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

const version = async (id: string) =>
  Number((await poolTest().query('select version from propuestas where id=$1', [id])).rows[0].version)

describe('agregar sitios', () => {
  it('a un BORRADOR: entra con el periodo de la propuesta y la versión no se mueve', async () => {
    const p = await crear(ca, alfa.sitioId)
    const r = await ca.pedir(`/api/propuestas/${p.id}/items/`, {
      cuerpo: { items: [{ sitioId: otroSitioAlfa, precio: 30_000 }] },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    expect(r.datos.items).toHaveLength(2)
    const fechas = await poolTest().query(
      `select distinct to_char(fecha_inicio,'YYYY-MM-DD') fi, to_char(fecha_fin,'YYYY-MM-DD') ff
         from propuesta_items where propuesta_id=$1`,
      [p.id],
    )
    expect(fechas.rows).toEqual([{ fi: enDias(5), ff: enDias(34) }])
    expect(await version(p.id)).toBe(1)
  })

  it('a una ENVIADA: sube la versión (renegociación)', async () => {
    const p = await crear(ca, alfa.sitioId)
    await ca.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'ENVIADA' } })
    const r = await ca.pedir(`/api/propuestas/${p.id}/items/`, {
      cuerpo: { items: [{ sitioId: otroSitioAlfa, precio: 30_000 }] },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    expect(await version(p.id)).toBe(2)
  })

  it('NEGATIVO · B40 por la puerta nueva: una vendedora a 1 peso → 403 y no se agrega nada', async () => {
    const p = await crear(ca, alfa.sitioId)
    const r = await cVend.pedir(`/api/propuestas/${p.id}/items/`, {
      cuerpo: { items: [{ sitioId: otroSitioAlfa, unidad: 'mensual', tarifaUnitaria: 1 }] },
    })
    expect(r.status, JSON.stringify(r.datos)).toBe(403)
    expect(await cuenta('select count(*) n from propuesta_items where propuesta_id=$1', [p.id])).toBe(1)
  })

  it('NEGATIVO · a una APROBADA no (409)', async () => {
    const p = await crear(ca, alfa.sitioId)
    await ca.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'APROBADA' } })
    const r = await ca.pedir(`/api/propuestas/${p.id}/items/`, {
      cuerpo: { items: [{ sitioId: otroSitioAlfa, precio: 30_000 }] },
    })
    expect(r.status).toBe(409)
  })

  it('R2 · beta no agrega sitios a una propuesta de alfa (404)', async () => {
    const p = await crear(ca, alfa.sitioId)
    const r = await cb.pedir(`/api/propuestas/${p.id}/items/`, {
      cuerpo: { items: [{ sitioId: beta.sitioId, precio: 45_000 }] },
    })
    expect(r.status).toBe(404)
    expect(await cuenta('select count(*) n from propuesta_items where propuesta_id=$1', [p.id])).toBe(1)
  })
})

describe('quitar sitios', () => {
  async function conDos() {
    const p = await crear(ca, alfa.sitioId)
    const r = await ca.pedir(`/api/propuestas/${p.id}/items/`, {
      cuerpo: { items: [{ sitioId: otroSitioAlfa, precio: 30_000 }] },
    })
    return { id: p.id, items: r.datos.items as { id: string; sitioId: string }[] }
  }

  it('se quita uno; el último NUNCA (409)', async () => {
    const p = await conDos()
    const r = await ca.pedir(`/api/propuestas/items/${p.items[1].id}/`, { metodo: 'DELETE' })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.items).toHaveLength(1)
    const ult = await ca.pedir(`/api/propuestas/items/${p.items[0].id}/`, { metodo: 'DELETE' })
    expect(ult.status).toBe(409)
    expect(await cuenta('select count(*) n from propuesta_items where propuesta_id=$1', [p.id])).toBe(1)
  })

  it('en una ENVIADA sube la versión', async () => {
    const p = await conDos()
    await ca.pedir(`/api/propuestas/${p.id}/`, { metodo: 'PATCH', cuerpo: { estatus: 'ENVIADA' } })
    const antes = await version(p.id)
    await ca.pedir(`/api/propuestas/items/${p.items[1].id}/`, { metodo: 'DELETE' })
    expect(await version(p.id)).toBe(antes + 1)
  })

  it('R2 · beta no quita un sitio de alfa (404)', async () => {
    const p = await conDos()
    const r = await cb.pedir(`/api/propuestas/items/${p.items[1].id}/`, { metodo: 'DELETE' })
    expect(r.status).toBe(404)
    expect(await cuenta('select count(*) n from propuesta_items where propuesta_id=$1', [p.id])).toBe(2)
  })
})
