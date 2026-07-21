import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as bcrypt from 'bcryptjs'
import { app } from '../src/app'
import { publicPrisma, disconnectAll } from '../src/db/client'

const TENANT_SLUG = 'dev'
const EMAIL = 'owner@dev.com'
const PASSWORD = 'DevPass123!'

function h(token?: string) {
  return {
    'content-type': 'application/json',
    'x-tenant-slug': TENANT_SLUG,
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  }
}

async function login() {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    headers: h(),
    payload: { email: EMAIL, password: PASSWORD },
  })
  return JSON.parse(res.body).accessToken as string
}

beforeAll(async () => {
  await app.ready()

  let tenant = await publicPrisma.tenant.findUnique({ where: { subdominioBase: TENANT_SLUG } })
  if (!tenant) {
    tenant = await publicPrisma.tenant.create({
      data: { nombre: 'Dev Tenant', subdominioBase: TENANT_SLUG, dbSchema: 'tenant_template' },
    })
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10)
  await publicPrisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: EMAIL } },
    create: { tenantId: tenant.id, nombre: 'Dev Owner', email: EMAIL, passwordHash, rolId: 'owner' },
    update: { passwordHash },
  })
})

afterAll(async () => {
  await app.close()
  await disconnectAll()
})

describe('Módulo Comercial — flujo completo', () => {
  let token: string
  let clienteId: string
  let campanaId: string
  let lineId: string
  let portalToken: string
  let sitioId: string

  it('Login como owner del tenant dev', async () => {
    token = await login()
    expect(token).toBeTruthy()
    console.log('\n[LOGIN] token obtenido ✓')
  })

  it('PASO 0 — Obtiene un sitio disponible para usarlo en la línea', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/inventario',
      headers: h(token),
    })
    const body = JSON.parse(res.body)
    // May be empty in test env — fallback to a synthetic sitioId
    sitioId = body[0]?.id ?? 'test-sitio-id'
    console.log(`\n[PASO 0] Inventario: ${body.length} sitios disponibles. Using sitioId: ${sitioId}`)
    expect(res.statusCode).toBe(200)
  })

  it('PASO 1 — POST /clientes crea cliente', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/clientes',
      headers: h(token),
      payload: { nombre: 'Acme Corp', rfc: 'ACM990101AAA', tipo: 'DIRECTO' },
    })
    const body = JSON.parse(res.body)
    console.log('\n[PASO 1] POST /clientes')
    console.log(`  Status  : ${res.statusCode}`)
    console.log(`  Cliente : ${body.id} — ${body.nombre}`)
    expect(res.statusCode).toBe(201)
    clienteId = body.id
  })

  it('PASO 2 — POST /campanas crea campaña OOH en DRAFT', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/campanas',
      headers: h(token),
      payload: {
        nombre: 'Campaña Test OOH',
        clienteId,
        tipoCampana: 'OOH',
        fechaInicio: new Date(Date.now() + 86400_000).toISOString(),   // tomorrow
        fechaFin: new Date(Date.now() + 30 * 86400_000).toISOString(), // +30 days
        presupuestoBruto: 150000,
        moneda: 'MXN',
        notas: 'Campaña de prueba Fase 4',
      },
    })
    const body = JSON.parse(res.body)
    console.log('\n[PASO 2] POST /campanas')
    console.log(`  Status         : ${res.statusCode}`)
    console.log(`  Folio          : ${body.folio}`)
    console.log(`  estadoComercial: ${body.estadoComercial}`)
    expect(res.statusCode).toBe(201)
    expect(body.folio).toMatch(/^CAMP-\d{4}-\d{4}$/)
    expect(body.estadoComercial).toBe('DRAFT')
    campanaId = body.id
  })

  it('PASO 3 — POST /campanas/:id/lines agrega línea de campaña', async () => {
    const inicio = new Date(Date.now() + 86400_000).toISOString()
    const fin = new Date(Date.now() + 30 * 86400_000).toISOString()
    const res = await app.inject({
      method: 'POST',
      url: `/campanas/${campanaId}/lines`,
      headers: h(token),
      payload: {
        sitioId,
        fechaInicio: inicio,
        fechaFin: fin,
        tipoVenta: 'DAY_PACK',
        precio: 50000,
        cantidad: 30,
        unidad: 'DIA',
      },
    })
    const body = JSON.parse(res.body)
    console.log('\n[PASO 3] POST /campanas/:id/lines')
    console.log(`  Status    : ${res.statusCode}`)
    console.log(`  Line ID   : ${body.id}`)
    console.log(`  sitioId   : ${body.sitioId}`)
    console.log(`  tipoVenta : ${body.tipoVenta}`)
    expect(res.statusCode).toBe(201)
    lineId = body.id
  })

  it('PASO 4 — POST /campanas/:id/confirmar crea OT automáticamente', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/campanas/${campanaId}/confirmar`,
      headers: h(token),
      payload: {},
    })
    const body = JSON.parse(res.body)
    console.log('\n[PASO 4] POST /campanas/:id/confirmar')
    console.log(`  Status         : ${res.statusCode}`)
    console.log(`  estadoComercial: ${body.estadoComercial}`)
    if (res.statusCode !== 200) console.log(`  Error: ${body.error ?? JSON.stringify(body)}`)
    expect(res.statusCode).toBe(200)
    expect(body.estadoComercial).toBe('CONFIRMADA')
  })

  it('PASO 5 — GET /campanas/:id/readiness devuelve estado del readiness', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/campanas/${campanaId}/readiness`,
      headers: h(token),
    })
    const body = JSON.parse(res.body)
    console.log('\n[PASO 5] GET /campanas/:id/readiness')
    console.log(`  Status           : ${res.statusCode}`)
    console.log(`  tipoCampana      : ${body.tipoCampana}`)
    console.log(`  listaParaFacturar: ${body.listaParaFacturar}`)
    console.log(`  ocRecibida       : ${body.items?.ocRecibida?.ok}`)
    console.log(`  otCompletada     : ${body.items?.otCompletada?.ok} (requerida: ${body.items?.otCompletada?.requerida})`)
    console.log(`  trafficFinalizado: ${body.items?.trafficFinalizado?.ok} (requerido: ${body.items?.trafficFinalizado?.requerido})`)
    expect(res.statusCode).toBe(200)
    expect(body.tipoCampana).toBe('OOH')
    expect(body.listaParaFacturar).toBe(false)
    expect(body.items.otCompletada.requerida).toBe(true)
    expect(body.items.trafficFinalizado.requerido).toBe(false)
  })

  it('PASO 6 — POST /campanas/:id/portal-activate activa el portal', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/campanas/${campanaId}/portal-activate`,
      headers: h(token),
      payload: {},
    })
    const body = JSON.parse(res.body)
    console.log('\n[PASO 6] POST /campanas/:id/portal-activate')
    console.log(`  Status      : ${res.statusCode}`)
    console.log(`  portalToken : ${body.portalToken}`)
    console.log(`  url         : ${body.url}`)
    expect(res.statusCode).toBe(200)
    expect(body.portalToken).toBeTruthy()
    expect(body.url).toContain(body.portalToken)
    portalToken = body.portalToken
  })

  it('PASO 7 — GET /portal/:token devuelve vista pública', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/portal/${portalToken}`,
      headers: { 'x-tenant-slug': TENANT_SLUG },
    })
    const body = JSON.parse(res.body)
    console.log('\n[PASO 7] GET /portal/:token')
    console.log(`  Status         : ${res.statusCode}`)
    console.log(`  folio          : ${body.campana?.folio}`)
    console.log(`  nombre         : ${body.campana?.nombre}`)
    console.log(`  clienteNombre  : ${body.campana?.clienteNombre}`)
    console.log(`  estadoComercial: ${body.campana?.estadoComercial}`)
    console.log(`  etapas         : ${body.etapas?.map((e: any) => `${e.nombre}(${e.completado ? '✓' : '·'})`).join(', ')}`)
    expect(res.statusCode).toBe(200)
    expect(body.campana.folio).toMatch(/^CAMP-/)
    expect(body.etapas).toHaveLength(8)
    expect(body.etapas[0].completado).toBe(true) // Campaña creada — always true
    expect(body.etapas[1].completado).toBe(true) // Inventario confirmado — line exists
  })
})
