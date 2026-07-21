/**
 * E2E: Campaña OOH completa → LISTA_FACTURAR
 *
 * Corre el flujo real de punta a punta usando Fastify inject (sin HTTP real).
 * Cada bloque depende del estado generado por el anterior.
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import * as bcrypt from 'bcryptjs'
import { app } from '../src/app'
import { publicPrisma, getPrismaForTenant, disconnectAll } from '../src/db/client'

// ─── Test tenant ──────────────────────────────────────────────────────────────
const SLUG = 'dev'          // reuse dev tenant → dbSchema tenant_template
const EMAIL = 'e2e-owner@test.com'
const PASSWORD = 'E2ePass123!'

// ─── Shared state across tests ────────────────────────────────────────────────
let token: string
let tenantId: string
let sitioId: string
let sitioDoohId: string
let clienteId: string
let campanaId: string
let otId: string
let portalToken: string
let campanaDoohId: string
let toDoohId: string

// ─── Helpers ──────────────────────────────────────────────────────────────────
function h(tok?: string) {
  return {
    'content-type': 'application/json',
    'x-tenant-slug': SLUG,
    ...(tok ? { authorization: `Bearer ${tok}` } : {}),
  }
}

function multipartHeader(boundary: string, tok: string) {
  return {
    'content-type': `multipart/form-data; boundary=${boundary}`,
    'x-tenant-slug': SLUG,
    authorization: `Bearer ${tok}`,
  }
}

/** Build a minimal multipart body with one file field */
function buildMultipart(boundary: string, fieldName: string, filename: string, mime: string, content: Buffer): Buffer {
  const head = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"`,
    `Content-Type: ${mime}`,
    '',
    '',
  ].join('\r\n')
  const tail = `\r\n--${boundary}--\r\n`
  return Buffer.concat([Buffer.from(head), content, Buffer.from(tail)])
}

const FAKE_PDF = Buffer.from('%PDF-1.4 1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>')

// ─── Setup ────────────────────────────────────────────────────────────────────
beforeAll(async () => {
  await app.ready()

  // Create or fetch tenant pointing to tenant_template schema
  let tenant = await publicPrisma.tenant.findUnique({ where: { subdominioBase: SLUG } })
  if (!tenant) {
    tenant = await publicPrisma.tenant.create({
      data: { nombre: 'E2E Tenant', subdominioBase: SLUG, dbSchema: 'tenant_template' },
    })
  }
  tenantId = tenant.id

  // Owner user
  const passwordHash = await bcrypt.hash(PASSWORD, 10)
  await publicPrisma.user.upsert({
    where: { tenantId_email: { tenantId, email: EMAIL } },
    create: { tenantId, nombre: 'E2E Owner', email: EMAIL, passwordHash, rolId: 'owner' },
    update: { passwordHash },
  })

  // Seed a test OOH sitio
  const prisma = getPrismaForTenant('tenant_template')
  const oohSitio = await (prisma as any).sitio.create({
    data: {
      claveInterna: `E2E-OOH-${Date.now()}`,
      nombre: 'Espectacular E2E Test',
      tipoMedio: 'ESPECTACULAR',
      lat: 19.4326,
      lng: -99.1332,
      direccion: 'Av. Reforma 100',
      ciudad: 'CDMX',
      estado: 'CDMX',
      estatusComercial: 'DISPONIBLE',
      estatusOperativo: 'ACTIVO',
    },
  })
  sitioId = oohSitio.id

  // Seed a DOOH sitio
  const doohSitio = await (prisma as any).sitio.create({
    data: {
      claveInterna: `E2E-DOOH-${Date.now()}`,
      nombre: 'Pantalla Digital E2E',
      tipoMedio: 'PANTALLA_DIGITAL',
      lat: 19.4280,
      lng: -99.1677,
      direccion: 'Insurgentes Sur 200',
      ciudad: 'CDMX',
      estado: 'CDMX',
      estatusComercial: 'DISPONIBLE',
      estatusOperativo: 'ACTIVO',
    },
  })
  sitioDoohId = doohSitio.id
})

afterAll(async () => {
  await app.close()
  await disconnectAll()
})

// ─── Flujo OOH ────────────────────────────────────────────────────────────────
describe('Flujo end-to-end: Campaña OOH → Facturación', () => {

  test('1. Login con owner → accessToken válido', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: h(),
      payload: { email: EMAIL, password: PASSWORD },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toHaveProperty('accessToken')
    expect(body.user.rol).toBe('owner')
    token = body.accessToken
  })

  test('2. Crear cliente', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/clientes',
      headers: h(token),
      payload: { nombre: 'Cliente E2E SA', rfc: 'CES990101AAA', tipo: 'DIRECTO' },
    })
    expect(res.statusCode).toBe(201)
    clienteId = JSON.parse(res.body).id
    expect(clienteId).toBeTruthy()
  })

  test('3. Crear campaña OOH en DRAFT', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/campanas',
      headers: h(token),
      payload: {
        nombre: 'Campaña E2E OOH',
        clienteId,
        tipoCampana: 'OOH',
        fechaInicio: new Date(Date.now() + 86400_000).toISOString(),
        fechaFin:    new Date(Date.now() + 30 * 86400_000).toISOString(),
        presupuestoBruto: 100000,
        moneda: 'MXN',
      },
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body.folio).toMatch(/^CAMP-\d{4}-\d{4}$/)
    expect(body.estadoComercial).toBe('DRAFT')
    campanaId = body.id
  })

  test('4. Agregar línea de campaña', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/campanas/${campanaId}/lines`,
      headers: h(token),
      payload: {
        sitioId,
        fechaInicio: new Date(Date.now() + 86400_000).toISOString(),
        fechaFin:    new Date(Date.now() + 30 * 86400_000).toISOString(),
        tipoVenta: 'DAY_PACK',
        precio: 50000,
        cantidad: 30,
        unidad: 'DIA',
      },
    })
    expect(res.statusCode).toBe(201)
    const line = JSON.parse(res.body)
    expect(line.sitioId).toBe(sitioId)
    expect(line.tipoVenta).toBe('DAY_PACK')
  })

  test('5. Confirmar campaña → genera OT automáticamente', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/campanas/${campanaId}/confirmar`,
      headers: h(token),
      payload: {},
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).estadoComercial).toBe('CONFIRMADA')

    // Verify OT was created
    const prisma = getPrismaForTenant('tenant_template')
    const ots = await (prisma as any).ordenTrabajo.findMany({ where: { campanaId } })
    expect(ots.length).toBeGreaterThan(0)
    otId = ots[0].id
  })

  test('6. Readiness inicial: todos los criterios en false', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/campanas/${campanaId}/readiness`,
      headers: h(token),
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.listaParaFacturar).toBe(false)
    expect(body.items.ocRecibida.ok).toBe(false)
    expect(body.items.fotosComprobatorias.ok).toBe(false)
    expect(body.items.reportePublicacion.ok).toBe(false)
  })

  test('7. Subir OC → ocRecibida = true', async () => {
    const boundary = 'e2e-boundary-oc'
    const body = buildMultipart(boundary, 'file', 'oc.pdf', 'application/pdf', FAKE_PDF)

    const res = await app.inject({
      method: 'POST',
      url: `/campanas/${campanaId}/readiness/oc`,
      headers: multipartHeader(boundary, token),
      payload: body,
    })
    expect(res.statusCode).toBe(200)
    const result = JSON.parse(res.body)
    expect(result.items.ocRecibida.ok).toBe(true)
  })

  test('8. Completar OT con evidencia → fotosComprobatorias = true', async () => {
    // Register an evidencia (presigned URL flow: register the storageKey directly)
    const evRes = await app.inject({
      method: 'POST',
      url: `/ordenes-trabajo/${otId}/evidencias`,
      headers: h(token),
      payload: { storageKey: 'e2e/test-foto.jpg', tipo: 'FOTO' },
    })
    expect(evRes.statusCode).toBe(201)

    // Complete the OT
    const compRes = await app.inject({
      method: 'POST',
      url: `/ordenes-trabajo/${otId}/completar`,
      headers: h(token),
      payload: { notas: 'Completado en test E2E' },
    })
    expect(compRes.statusCode).toBe(200)

    // Check readiness
    const rdRes = await app.inject({
      method: 'GET',
      url: `/campanas/${campanaId}/readiness`,
      headers: h(token),
    })
    expect(rdRes.statusCode).toBe(200)
    const rd = JSON.parse(rdRes.body)
    expect(rd.items.fotosComprobatorias.ok).toBe(true)
    expect(rd.items.otCompletada.ok).toBe(true)
  })

  test('9. Subir reporte → reportePublicacion = true', async () => {
    const boundary = 'e2e-boundary-rep'
    const body = buildMultipart(boundary, 'file', 'reporte.pdf', 'application/pdf', FAKE_PDF)

    const res = await app.inject({
      method: 'POST',
      url: `/campanas/${campanaId}/readiness/reporte`,
      headers: multipartHeader(boundary, token),
      payload: body,
    })
    expect(res.statusCode).toBe(200)
    const result = JSON.parse(res.body)
    expect(result.items.reportePublicacion.ok).toBe(true)
  })

  test('10. Con todos los criterios ok → LISTA_FACTURAR', async () => {
    const rdRes = await app.inject({
      method: 'GET',
      url: `/campanas/${campanaId}/readiness`,
      headers: h(token),
    })
    expect(rdRes.statusCode).toBe(200)
    expect(JSON.parse(rdRes.body).listaParaFacturar).toBe(true)

    const campRes = await app.inject({
      method: 'GET',
      url: `/campanas/${campanaId}`,
      headers: h(token),
    })
    expect(campRes.statusCode).toBe(200)
    expect(JSON.parse(campRes.body).estadoComercial).toBe('LISTA_FACTURAR')
  })

  test('11. Activar portal → token generado', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/campanas/${campanaId}/portal-activate`,
      headers: h(token),
      payload: {},
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    // UUID format
    expect(body.portalToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    portalToken = body.portalToken
  })

  test('12. Portal público funciona con el token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/portal/${portalToken}`,
      headers: { 'x-tenant-slug': SLUG }, // no Authorization
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.etapas[0].completado).toBe(true) // Campaña creada
    expect(body.etapas[2].completado).toBe(true) // OC recibida
    expect(body.etapas[6].completado).toBe(true) // Reporte
    expect(body.etapas[7].completado).toBe(true) // Lista para facturar
  })
})

// ─── Flujo DOOH ───────────────────────────────────────────────────────────────
describe('Flujo DOOH: campaña digital', () => {

  test('Confirmar DOOH → TrafficOrder MANUAL creada', async () => {
    // Create DOOH campaign
    const campRes = await app.inject({
      method: 'POST',
      url: '/campanas',
      headers: h(token),
      payload: {
        nombre: 'Campaña E2E DOOH',
        clienteId,
        tipoCampana: 'DOOH',
        fechaInicio: new Date(Date.now() + 86400_000).toISOString(),
        fechaFin:    new Date(Date.now() + 30 * 86400_000).toISOString(),
        presupuestoBruto: 80000,
        moneda: 'MXN',
      },
    })
    expect(campRes.statusCode).toBe(201)
    campanaDoohId = JSON.parse(campRes.body).id

    // Add DOOH line
    await app.inject({
      method: 'POST',
      url: `/campanas/${campanaDoohId}/lines`,
      headers: h(token),
      payload: {
        sitioId: sitioDoohId,
        fechaInicio: new Date(Date.now() + 86400_000).toISOString(),
        fechaFin:    new Date(Date.now() + 30 * 86400_000).toISOString(),
        tipoVenta: 'PROG_DIRECT',
        precio: 80000,
        cantidad: 1,
        unidad: 'PAQUETE',
      },
    })

    // Confirm → should create TrafficOrder
    const confRes = await app.inject({
      method: 'POST',
      url: `/campanas/${campanaDoohId}/confirmar`,
      headers: h(token),
      payload: {},
    })
    expect(confRes.statusCode).toBe(200)
    expect(JSON.parse(confRes.body).estadoComercial).toBe('CONFIRMADA')

    // Verify TrafficOrder exists
    const prisma = getPrismaForTenant('tenant_template')
    const tos = await (prisma as any).trafficOrder.findMany({ where: { campanaId: campanaDoohId } })
    expect(tos.length).toBeGreaterThan(0)
    toDoohId = tos[0].id
  })

  test('Cambiar TO a FINALIZADA → readiness trafficFinalizado = true', async () => {
    // Update TO to FINALIZADA
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/traffic-orders/${toDoohId}/estado`,
      headers: h(token),
      payload: { estadoTecnico: 'FINALIZADA' },
    })
    expect(patchRes.statusCode).toBe(200)
    expect(JSON.parse(patchRes.body).estadoTecnico).toBe('FINALIZADA')

    // Check readiness
    const rdRes = await app.inject({
      method: 'GET',
      url: `/campanas/${campanaDoohId}/readiness`,
      headers: h(token),
    })
    expect(rdRes.statusCode).toBe(200)
    const rd = JSON.parse(rdRes.body)
    expect(rd.items.trafficFinalizado.ok).toBe(true)
  })
})
