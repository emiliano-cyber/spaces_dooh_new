import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as bcrypt from 'bcryptjs'
import { app } from '../src/app'
import { publicPrisma, getPrismaForTenant, disconnectAll } from '../src/db/client'
import { ConnectorRegistry } from '../src/connectors/connector.registry'
import { ManualConnector } from '../src/connectors/manual/manual.connector'

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
  const res = await app.inject({ method: 'POST', url: '/auth/login', headers: h(), payload: { email: EMAIL, password: PASSWORD } })
  return JSON.parse(res.body).accessToken as string
}

beforeAll(async () => {
  await app.ready()
  let tenant = await publicPrisma.tenant.findUnique({ where: { subdominioBase: TENANT_SLUG } })
  if (!tenant) tenant = await publicPrisma.tenant.create({ data: { nombre: 'Dev', subdominioBase: TENANT_SLUG, dbSchema: 'tenant_template' } })
  const passwordHash = await bcrypt.hash(PASSWORD, 10)
  await publicPrisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: EMAIL } },
    create: { tenantId: tenant.id, nombre: 'Dev Owner', email: EMAIL, passwordHash, rolId: 'owner' },
    update: { passwordHash },
  })
})

afterAll(async () => { await app.close(); await disconnectAll() })

describe('Extra checks — Fase 4', () => {
  let token: string
  let campOOH: string
  let campDOOH: string
  let portalToken: string

  it('login', async () => { token = await login(); expect(token).toBeTruthy() })

  it('ConnectorRegistry.get(INEXISTENTE) retorna ManualConnector', () => {
    const registry = new ConnectorRegistry()
    const connector = registry.get('TIPO_INEXISTENTE_XYZ')
    expect(connector).toBeInstanceOf(ManualConnector)
  })

  it('ManualConnector.publish() no lanza, devuelve referenciaExterna', async () => {
    const mc = new ManualConnector()
    const res = await mc.publish({
      campanaId: 'x', trafficOrderId: 'y', campanaFolio: 'CAMP-TEST',
      clienteNombre: 'Acme', pantallasExternas: [], creatividades: [],
      horario: null, prioridad: 5, tipoVenta: 'DAY_PACK',
    })
    expect(res.referenciaExterna).toMatch(/^MANUAL-/)
    expect(await mc.healthCheck()).toBe(true)
  })

  // Setup OOH campaign and confirm
  it('confirmar OOH → genera OrdenTrabajo', async () => {
    const cli = await app.inject({ method: 'POST', url: '/clientes', headers: h(token), payload: { nombre: 'Extra Corp', rfc: 'EXT010101AAA', email: 'extra@test.com' } })
    const clienteId = JSON.parse(cli.body).id
    const tomorrow = new Date(Date.now() + 86400000).toISOString()
    const next30 = new Date(Date.now() + 30 * 86400000).toISOString()

    const inv = await app.inject({ method: 'GET', url: '/inventario', headers: h(token) })
    const sitioId = JSON.parse(inv.body)[0]?.id
    expect(sitioId).toBeTruthy()

    const c = await app.inject({ method: 'POST', url: '/campanas', headers: h(token), payload: { nombre: 'Extra OOH', clienteId, tipoCampana: 'OOH', tipoVenta: 'DAY_PACK', fechaInicio: tomorrow, fechaFin: next30 } })
    campOOH = JSON.parse(c.body).id
    await app.inject({ method: 'POST', url: `/campanas/${campOOH}/lines`, headers: h(token), payload: { sitioId, fechaInicio: tomorrow, fechaFin: next30, precio: 5000, tipoVenta: 'DAY_PACK' } })

    const conf = await app.inject({ method: 'POST', url: `/campanas/${campOOH}/confirmar`, headers: h(token), payload: {} })
    expect(JSON.parse(conf.body).estadoComercial).toBe('CONFIRMADA')

    // Verify OT
    const tenant = await publicPrisma.tenant.findUnique({ where: { subdominioBase: TENANT_SLUG } })
    const prisma = await getPrismaForTenant(tenant!.dbSchema)
    const ots = await (prisma as any).ordenTrabajo.findMany({ where: { campanaId: campOOH } })
    expect(ots.length).toBeGreaterThanOrEqual(1)
    console.log(`[OOH] OrdenTrabajo creada: ${ots[0].folio} — ${ots[0].tipo}`)
  })

  it('confirmar DOOH → genera TrafficOrder via ManualConnector', async () => {
    const cli = await app.inject({ method: 'POST', url: '/clientes', headers: h(token), payload: { nombre: 'DOOH Corp', rfc: 'DOO010101AAA', email: 'dooh@test.com' } })
    const clienteId = JSON.parse(cli.body).id
    const tomorrow = new Date(Date.now() + 86400000).toISOString()
    const next30 = new Date(Date.now() + 30 * 86400000).toISOString()

    const inv = await app.inject({ method: 'GET', url: '/inventario', headers: h(token) })
    const sitioId = JSON.parse(inv.body)[0]?.id

    const c = await app.inject({ method: 'POST', url: '/campanas', headers: h(token), payload: { nombre: 'Extra DOOH', clienteId, tipoCampana: 'DOOH', tipoVenta: 'DAY_PACK', fechaInicio: tomorrow, fechaFin: next30 } })
    campDOOH = JSON.parse(c.body).id
    await app.inject({ method: 'POST', url: `/campanas/${campDOOH}/lines`, headers: h(token), payload: { sitioId, fechaInicio: tomorrow, fechaFin: next30, precio: 5000, tipoVenta: 'DAY_PACK' } })

    const conf = await app.inject({ method: 'POST', url: `/campanas/${campDOOH}/confirmar`, headers: h(token), payload: {} })
    expect(JSON.parse(conf.body).estadoComercial).toBe('CONFIRMADA')

    // Verify TrafficOrder
    const toRes = await app.inject({ method: 'GET', url: '/traffic-orders', headers: h(token) })
    const tos = JSON.parse(toRes.body)
    const campaTOs = tos.filter((t: any) => t.campana?.id === campDOOH)
    expect(campaTOs.length).toBeGreaterThanOrEqual(1)
    expect(campaTOs[0].folio).toMatch(/^TO-/)
    console.log(`[DOOH] TrafficOrder creada: ${campaTOs[0].folio} ref=${campaTOs[0].referenciaExterna}`)
  })

  it('POST /readiness/oc → sube OC, ocRecibida.ok pasa a true', async () => {
    const fakePdf = Buffer.from('%PDF-1.4 fake pdf')
    const boundary = 'boundary123'
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="oc.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      fakePdf,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ])
    const res = await app.inject({
      method: 'POST',
      url: `/campanas/${campOOH}/readiness/oc`,
      headers: { ...h(token), 'content-type': `multipart/form-data; boundary=${boundary}` },
      body,
    })
    expect(res.statusCode).toBe(200)
    const readiness = JSON.parse(res.body)
    // endpoint returns ReadinessStatus, ocRecibida is under items
    expect(readiness.items.ocRecibida.ok).toBe(true)
    console.log('[OC] Upload response ocRecibida.ok =', readiness.items.ocRecibida.ok)
  })

  it('readiness.items.ocRecibida.ok = true após upload', async () => {
    const res = await app.inject({ method: 'GET', url: `/campanas/${campOOH}/readiness`, headers: h(token) })
    const data = JSON.parse(res.body)
    expect(data.items.ocRecibida.ok).toBe(true)
    console.log('[READINESS] ocRecibida.ok =', data.items.ocRecibida.ok)
  })

  it('GET /portal/:token → 8 etapas, subioPorExterno via POST', async () => {
    const pa = await app.inject({ method: 'POST', url: `/campanas/${campOOH}/portal-activate`, headers: h(token), payload: {} })
    const paBody = JSON.parse(pa.body)
    portalToken = paBody.portalToken ?? paBody.url?.split('/').pop()
    expect(portalToken).toBeTruthy()

    const pr = await app.inject({ method: 'GET', url: `/portal/${portalToken}`, headers: { 'x-tenant-slug': TENANT_SLUG } })
    const pdata = JSON.parse(pr.body)
    expect(pdata.etapas.length).toBe(8)
    expect(pdata.etapas[0].completado).toBe(true)
    console.log('[PORTAL] etapas[0..2]:', pdata.etapas.slice(0,3).map((e: any) => `${e.nombre}(${e.completado ? '✓' : '·'})`).join(', '))
  })

  it('POST /portal/:token/creatividades → subioPorExterno = true', async () => {
    const fakeJpg = Buffer.from('\xff\xd8\xff fake jpeg')
    const boundary = 'portalboundary'
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="banner.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      fakeJpg,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ])
    const res = await app.inject({
      method: 'POST',
      url: `/portal/${portalToken}/creatividades`,
      headers: { 'x-tenant-slug': TENANT_SLUG, 'content-type': `multipart/form-data; boundary=${boundary}` },
      body,
    })
    expect(res.statusCode).toBe(201)
    const d = JSON.parse(res.body)
    expect(d.creatividad.subioPorExterno).toBe(true)
    expect(d.creatividad.formato).toBe('JPG')
    console.log('[PORTAL CREATIVO] id:', d.creatividad.id, 'subioPorExterno:', d.creatividad.subioPorExterno)
  })

  it('LISTA_FACTURAR — campana llega a LISTA_FACTURAR cuando todos los criterios se cumplen', async () => {
    // For OOH we need: OC ✓ (done), OT completada, reportePublicacion
    // Mark the OT completed and add reporte to trigger auto-transition
    const tenant = await publicPrisma.tenant.findUnique({ where: { subdominioBase: TENANT_SLUG } })
    const prisma = await getPrismaForTenant(tenant!.dbSchema)

    // Complete OT and add a photo (evidencia) so fotosComprobatorias.ok = true
    const ots = await (prisma as any).ordenTrabajo.findMany({ where: { campanaId: campOOH } })
    if (ots.length > 0) {
      await (prisma as any).ordenTrabajo.update({ where: { id: ots[0].id }, data: { estatus: 'COMPLETADA' } })
      // Add a fake evidencia so conteoEvidencias >= 1
      await (prisma as any).evidenciaOT.create({
        data: { otId: ots[0].id, fotoUrl: 'https://placeholder/foto.jpg', storageKey: 'test/foto.jpg', uploadedBy: 'test-user' },
      })
    }
    // Set reportePublicacion and move to COMPLETADA to trigger auto-transition
    await (prisma as any).campana.update({ where: { id: campOOH }, data: { reportePublicacion: true, estadoComercial: 'COMPLETADA' } })

    // Call readiness — should auto-transition
    const res = await app.inject({ method: 'GET', url: `/campanas/${campOOH}/readiness`, headers: h(token) })
    const data = JSON.parse(res.body)
    console.log('[READINESS FULL]', JSON.stringify({ listaParaFacturar: data.listaParaFacturar, ocOk: data.items.ocRecibida.ok, otOk: data.items.otCompletada.ok, reporteOk: data.items.reportePublicacion.ok }))

    // Verify estadoComercial changed
    const campRes = await app.inject({ method: 'GET', url: `/campanas/${campOOH}`, headers: h(token) })
    const camp = JSON.parse(campRes.body)
    console.log('[AUTO-TRANSITION] estadoComercial =', camp.estadoComercial)
    expect(data.listaParaFacturar).toBe(true)
    expect(camp.estadoComercial).toBe('LISTA_FACTURAR')
  })
})
