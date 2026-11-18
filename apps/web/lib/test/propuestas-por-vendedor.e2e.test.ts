import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  ADR 0051 · el vendedor ve SOLO sus propuestas; quien tiene
//  `comercial.aprobar`, todas. Decisión del dueño del 17/11 («sus propuestas el
//  vendedor, el resto todas»).
// ----------------------------------------------------------------------------
//  Lo que se demuestra es lo que se IMPIDE: la de otro vendedor no llega en la
//  lista (`/api/estado`), ni en el resumen, y CADA ruta por id —editar, borrar,
//  sitios, cupón, paquete, enviar, generar campaña, renglones— contesta 404.
//  Y que la liga pública no enseña el historial de cambios (decisión del dueño:
//  es interno).
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let vendedor: Cliente
let vendedor2: Cliente
let gerente: Cliente
let deMariana: any
let deLuis: any

const correo = (q: string) => `${q}@vendedor.test`

async function sembrarUsuario(nombre: string, quien: string, rol: string) {
  const r = await poolTest().query(
    `insert into usuarios (nombre, email, cargo, rol, password_hash, activo, tenant_id)
     values ($1,$2,$3,$4::rol_demo,$5,true,$6) returning id`,
    [nombre, correo(quien), nombre, rol, await bcrypt.hash(PASSWORD_DEMO, 4), org.id],
  )
  return r.rows[0].id as string
}

async function entrar(email: string) {
  const c = new Cliente()
  await c.entrar(email, PASSWORD_DEMO)
  return c
}

async function crear(c: Cliente, nombre: string) {
  const r = await c.pedir('/api/propuestas/', {
    cuerpo: {
      nombre,
      clienteId: org.clienteId,
      fechaInicio: enDias(1),
      fechaFin: enDias(30),
      items: [{ sitioId: org.sitioId, unidad: 'mensual', tarifaUnitaria: 45_000, cantidad: 1 }],
    },
  })
  expect(r.status, JSON.stringify(r.datos)).toBe(201)
  return r.datos
}

const idsEnEstado = async (c: Cliente) => ((await c.pedir('/api/estado/')).datos.propuestas as any[]).map((p) => p.id)

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('vend')
  await sembrarUsuario('Mariana López', 'v1', 'VENDEDOR')
  await sembrarUsuario('Luis Herrera', 'v2', 'VENDEDOR')
  await sembrarUsuario('Gerente', 'gerente', 'GERENTE_VENTAS')
  await arrancarServidor()
  vendedor = await entrar(correo('v1'))
  vendedor2 = await entrar(correo('v2'))
  gerente = await entrar(correo('gerente'))
  deMariana = await crear(vendedor, 'De Mariana')
  deLuis = await crear(vendedor2, 'De Luis')
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

describe('1 · la lista y el resumen', () => {
  it('el vendedor recibe solo las suyas; quien aprueba, todas', async () => {
    expect(await idsEnEstado(vendedor)).toEqual([deMariana.id])
    expect(await idsEnEstado(vendedor2)).toEqual([deLuis.id])
    expect((await idsEnEstado(gerente)).sort()).toEqual([deMariana.id, deLuis.id].sort())
  })

  it('el resumen del vendedor cuenta solo lo suyo', async () => {
    const mio = (await vendedor.pedir('/api/propuestas/resumen/?periodo=mes')).datos.resumen
    expect(mio.generadas).toBe(1)
    expect(mio.porVendedor.map((v: any) => v.vendedor)).toEqual(['Mariana López'])
    const todo = (await gerente.pedir('/api/propuestas/resumen/?periodo=mes')).datos.resumen
    expect(todo.generadas).toBe(2)
    expect(todo.porVendedor.map((v: any) => v.vendedor).sort()).toEqual(['Luis Herrera', 'Mariana López'])
  })
})

describe('2 · cada ruta por id contesta 404 con la de otro', () => {
  it('editar, estatus, borrar, ligar', async () => {
    const r = (m: string, cuerpo?: unknown) => vendedor.pedir(`/api/propuestas/${deLuis.id}/`, { metodo: m, cuerpo })
    expect((await r('PATCH', { nombre: 'Mía' })).status).toBe(404)
    expect((await r('PATCH', { estatus: 'ENVIADA' })).status).toBe(404)
    expect((await r('PATCH', { oportunidadId: null })).status).toBe(404)
    expect((await r('DELETE')).status).toBe(404)
  })

  it('sitios, cupón, paquete, enviar y generar campaña', async () => {
    const base = `/api/propuestas/${deLuis.id}`
    const casos: [string, string, unknown?][] = [
      [`${base}/items/`, 'POST', { items: [{ sitioId: org.sitioId, unidad: 'mensual', tarifaUnitaria: 1, cantidad: 1 }] }],
      [`${base}/codigo/`, 'GET'],
      [`${base}/codigo/`, 'POST', { codigo: 'X' }],
      [`${base}/codigo/`, 'DELETE'],
      [`${base}/paquete/`, 'POST', { paqueteId: '00000000-0000-0000-0000-000000000000' }],
      [`${base}/paquete/`, 'DELETE'],
      [`${base}/enviar/`, 'POST', {}],
      [`${base}/generar-campana/`, 'POST', {}],
    ]
    for (const [ruta, metodo, cuerpo] of casos) {
      expect((await vendedor.pedir(ruta, { metodo, cuerpo })).status, `${metodo} ${ruta}`).toBe(404)
    }
  })

  it('un renglón de la propuesta de otro: aprobarlo o quitarlo es 404', async () => {
    const item = deLuis.items[0].id
    expect((await vendedor.pedir(`/api/propuestas/items/${item}/`, { metodo: 'PATCH', cuerpo: { aprobado: true } })).status).toBe(404)
    expect((await vendedor.pedir(`/api/propuestas/items/${item}/`, { metodo: 'DELETE' })).status).toBe(404)
    const fila = await poolTest().query('select aprobado from propuesta_items where id = $1', [item])
    expect(fila.rows[0].aprobado).toBe(false)
  })

  it('y nada de eso cambió la propuesta: ni nombre, ni estatus, ni historial', async () => {
    const p = (await poolTest().query('select nombre, estatus from propuestas where id = $1', [deLuis.id])).rows[0]
    expect(p).toEqual({ nombre: 'De Luis', estatus: 'BORRADOR' })
    const h = await poolTest().query('select accion from propuesta_cambios where propuesta_id = $1', [deLuis.id])
    expect(h.rows.map((x) => x.accion)).toEqual(['CREAR'])
  })

  it('quien aprueba sí la toca', async () => {
    expect(
      (await gerente.pedir(`/api/propuestas/${deLuis.id}/`, { metodo: 'PATCH', cuerpo: { nombre: 'De Luis (revisada)' } })).status,
    ).toBe(200)
  })

  it('un id que no es uuid es 404, no 500', async () => {
    expect((await vendedor.pedir('/api/propuestas/no-es-id/', { metodo: 'PATCH', cuerpo: { nombre: 'x' } })).status).toBe(404)
    expect((await vendedor.pedir('/api/propuestas/items/no-es-id/', { metodo: 'DELETE' })).status).toBe(404)
  })
})

describe('3 · la liga pública no enseña el historial', () => {
  it('lo que lee el cliente no trae cambios ni quién los hizo', async () => {
    await vendedor.pedir(`/api/propuestas/${deMariana.id}/`, { metodo: 'PATCH', cuerpo: { nombre: 'Para el cliente' } })
    const r = await new Cliente().pedir(`/api/propuestas/publica/${deMariana.tokenPublico}/`)
    expect(r.status).toBe(200)
    const texto = JSON.stringify(r.datos)
    expect(texto).not.toMatch(/propuesta_cambios|valor_anterior|valorAnterior|historial/i)
    expect(texto).not.toContain('De Mariana')
  })
})
