/**
 * readiness.service — targeted logic tests
 *
 * Covers the specific behavioural rules called out in the audit:
 *   ✓ check() queries OrdenTrabajo linked to the campaign
 *   ✓ EvidenciaOT count via OT join
 *   ✓ requiereOT = true for OOH / HIBRIDA
 *   ✓ requiereTraffic = true for DOOH / HIBRIDA
 *   ✓ Auto-transitions CONFIRMADA → LISTA_FACTURAR when all criteria met
 *   ✓ Emits campana.readiness.changed on LISTA_FACTURAR
 *   ✓ logAudit called with campana.lista_facturar
 *   ✗ Does NOT transition CANCELADA campaigns
 *   ✗ update() rejects edits on CONFIRMADA+ campaigns
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import * as bcrypt from 'bcryptjs'
import { app } from '../src/app'
import { publicPrisma, getPrismaForTenant, disconnectAll } from '../src/db/client'
import * as readinessService from '../src/modules/comercial/readiness.service'
import * as campanasService from '../src/modules/comercial/campanas.service'
import { eventBus } from '../src/core/events/event-bus'

const SLUG = 'dev'
const EMAIL = 'readiness-test@test.com'
const PASSWORD = 'Readiness123!'

let prisma: ReturnType<typeof getPrismaForTenant>
let tenantId: string
let userId: string

function h(tok: string) {
  return { 'content-type': 'application/json', 'x-tenant-slug': SLUG, authorization: `Bearer ${tok}` }
}

// ─── helpers ────────────────────────────────────────────────────────────────

async function mkSitio(suffix: string) {
  return (prisma as any).sitio.create({
    data: {
      claveInterna: `RDN-${suffix}-${Date.now()}`,
      nombre: `Readiness Sitio ${suffix}`,
      tipoMedio: 'ESPECTACULAR',
      lat: 19.43, lng: -99.13,
      direccion: 'Test', ciudad: 'CDMX', estado: 'CDMX',
      estatusComercial: 'DISPONIBLE', estatusOperativo: 'ACTIVO',
    },
  })
}

async function mkCliente() {
  return (prisma as any).cliente.create({
    data: { nombre: `Client-RDN-${Date.now()}`, tipo: 'DIRECTO' },
  })
}

async function mkCampana(clienteId: string, tipoCampana: string, estadoComercial = 'CONFIRMADA') {
  const folio = `TEST-RDN-${Date.now()}`
  return (prisma as any).campana.create({
    data: {
      folio,
      nombre: `Readiness Test ${tipoCampana}`,
      clienteId,
      tipoCampana,
      estadoComercial,
      fechaInicio: new Date(Date.now() + 86400_000),
      fechaFin: new Date(Date.now() + 30 * 86400_000),
      moneda: 'MXN',
    },
  })
}

async function mkLine(campanaId: string, sitioId: string) {
  return (prisma as any).campaignLine.create({
    data: {
      campanaId, sitioId, pantallasIds: [],
      fechaInicio: new Date(Date.now() + 86400_000),
      fechaFin: new Date(Date.now() + 30 * 86400_000),
      tipoVenta: 'DAY_PACK', precio: 10000, cantidad: 30, unidad: 'DIA',
    },
  })
}

async function mkOTCompletada(campanaId: string, sitioId: string) {
  const folio = `OT-TEST-${Date.now()}`
  return (prisma as any).ordenTrabajo.create({
    data: {
      folio, campanaId, sitioId,
      tipo: 'MONTAJE_LONA', prioridad: 'NORMAL', estatus: 'COMPLETADA',
      descripcion: 'Test OT',
      fechaCompletada: new Date(),
    },
  })
}

async function mkEvidencia(otId: string) {
  return (prisma as any).evidenciaOT.create({
    data: {
      otId,
      fotoUrl: 'https://test.com/foto.jpg',
      storageKey: `test/foto-${Date.now()}.jpg`,
      tipo: 'FOTO',
      uploadedBy: 'system',
    },
  })
}

// ─── setup ──────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await app.ready()

  let tenant = await publicPrisma.tenant.findUnique({ where: { subdominioBase: SLUG } })
  if (!tenant) {
    tenant = await publicPrisma.tenant.create({
      data: { nombre: 'Dev', subdominioBase: SLUG, dbSchema: 'tenant_template' },
    })
  }
  tenantId = tenant.id
  prisma = getPrismaForTenant(tenant.dbSchema)

  const hash = await bcrypt.hash(PASSWORD, 10)
  const user = await publicPrisma.user.upsert({
    where: { tenantId_email: { tenantId, email: EMAIL } },
    create: { tenantId, nombre: 'Readiness Tester', email: EMAIL, passwordHash: hash, rolId: 'owner' },
    update: { passwordHash: hash },
  })
  userId = user.id
})

afterAll(async () => {
  await app.close()
  await disconnectAll()
})

// ─── tests ──────────────────────────────────────────────────────────────────

describe('readiness.service — lógica de criterios', () => {

  test('OOH: requiereOT=true, requiereTraffic=false — items reflejan correctamente', async () => {
    const cliente = await mkCliente()
    const sitio = await mkSitio('OOH-A')
    const campana = await mkCampana(cliente.id, 'OOH')
    await mkLine(campana.id, sitio.id)

    const status = await readinessService.check(prisma, campana.id, tenantId, userId)

    expect(status.items.otCompletada.requerida).toBe(true)
    expect(status.items.trafficFinalizado.requerido).toBe(false)
    expect(status.items.trafficFinalizado.ok).toBe(true)   // not required → ok
    expect(status.items.otCompletada.ok).toBe(false)        // no OT completada yet
    expect(status.listaParaFacturar).toBe(false)
  })

  test('DOOH: requiereOT=false, requiereTraffic=true — items reflejan correctamente', async () => {
    const cliente = await mkCliente()
    const sitio = await mkSitio('DOOH-A')
    const campana = await mkCampana(cliente.id, 'DOOH')
    await mkLine(campana.id, sitio.id)

    const status = await readinessService.check(prisma, campana.id, tenantId, userId)

    expect(status.items.otCompletada.requerida).toBe(false)
    expect(status.items.otCompletada.ok).toBe(true)        // not required → ok
    expect(status.items.trafficFinalizado.requerido).toBe(true)
    expect(status.items.trafficFinalizado.ok).toBe(false)  // no TO finalizado yet
  })

  test('HIBRIDA: requiereOT=true Y requiereTraffic=true', async () => {
    const cliente = await mkCliente()
    const sitio = await mkSitio('HIB-A')
    const campana = await mkCampana(cliente.id, 'HIBRIDA')
    await mkLine(campana.id, sitio.id)

    const status = await readinessService.check(prisma, campana.id, tenantId, userId)

    expect(status.items.otCompletada.requerida).toBe(true)
    expect(status.items.trafficFinalizado.requerido).toBe(true)
  })

  test('EvidenciaOT: contador incrementa al agregar evidencias a la OT', async () => {
    const cliente = await mkCliente()
    const sitio = await mkSitio('OOH-EV')
    const campana = await mkCampana(cliente.id, 'OOH')
    await mkLine(campana.id, sitio.id)

    const ot = await mkOTCompletada(campana.id, sitio.id)

    // Before evidencia
    let status = await readinessService.check(prisma, campana.id, tenantId, userId)
    expect(status.items.fotosComprobatorias.cantidad).toBe(0)
    expect(status.items.fotosComprobatorias.ok).toBe(false)

    // After evidencia
    await mkEvidencia(ot.id)
    status = await readinessService.check(prisma, campana.id, tenantId, userId)
    expect(status.items.fotosComprobatorias.cantidad).toBe(1)
    expect(status.items.fotosComprobatorias.ok).toBe(true)
  })

  test('Auto-transición CONFIRMADA → LISTA_FACTURAR cuando todos los criterios se cumplen', async () => {
    const cliente = await mkCliente()
    const sitio = await mkSitio('OOH-AUTO')
    const campana = await mkCampana(cliente.id, 'OOH', 'CONFIRMADA')
    await mkLine(campana.id, sitio.id)

    const ot = await mkOTCompletada(campana.id, sitio.id)
    await mkEvidencia(ot.id)

    await (prisma as any).campana.update({
      where: { id: campana.id },
      data: { ocRecibida: true, reportePublicacion: true },
    })

    const status = await readinessService.check(prisma, campana.id, tenantId, userId)
    expect(status.listaParaFacturar).toBe(true)

    const updated = await (prisma as any).campana.findUnique({ where: { id: campana.id } })
    expect(updated.estadoComercial).toBe('LISTA_FACTURAR')
  })

  test('Emite campana.readiness.changed al transicionar a LISTA_FACTURAR', async () => {
    const cliente = await mkCliente()
    const sitio = await mkSitio('OOH-EVT')
    const campana = await mkCampana(cliente.id, 'OOH', 'CONFIRMADA')
    await mkLine(campana.id, sitio.id)

    const ot = await mkOTCompletada(campana.id, sitio.id)
    await mkEvidencia(ot.id)
    await (prisma as any).campana.update({
      where: { id: campana.id },
      data: { ocRecibida: true, reportePublicacion: true },
    })

    let eventEmitted = false
    let eventPayload: any = null
    const handler = (payload: any) => {
      if (payload.campanaId === campana.id) { eventEmitted = true; eventPayload = payload }
    }
    eventBus.on('campana.readiness.changed', handler)

    await readinessService.check(prisma, campana.id, tenantId, userId)

    eventBus.off('campana.readiness.changed', handler)
    expect(eventEmitted).toBe(true)
    expect(eventPayload?.listaParaFacturar).toBe(true)
  })

  test('logAudit registra campana.lista_facturar', async () => {
    const cliente = await mkCliente()
    const sitio = await mkSitio('OOH-LOG')
    const campana = await mkCampana(cliente.id, 'OOH', 'CONFIRMADA')
    await mkLine(campana.id, sitio.id)

    const ot = await mkOTCompletada(campana.id, sitio.id)
    await mkEvidencia(ot.id)
    await (prisma as any).campana.update({
      where: { id: campana.id },
      data: { ocRecibida: true, reportePublicacion: true },
    })

    await readinessService.check(prisma, campana.id, tenantId, userId)

    const log = await (prisma as any).auditLog.findFirst({
      where: { entidadId: campana.id, accion: 'campana.lista_facturar' },
      orderBy: { timestamp: 'desc' },
    })
    expect(log).not.toBeNull()
    expect(log.accion).toBe('campana.lista_facturar')
  })

  test('Campaña CANCELADA NO transiciona a LISTA_FACTURAR aunque criterios ok', async () => {
    const cliente = await mkCliente()
    const sitio = await mkSitio('OOH-CANC')
    const campana = await mkCampana(cliente.id, 'OOH', 'CANCELADA')
    await mkLine(campana.id, sitio.id)

    const ot = await mkOTCompletada(campana.id, sitio.id)
    await mkEvidencia(ot.id)
    await (prisma as any).campana.update({
      where: { id: campana.id },
      data: { ocRecibida: true, reportePublicacion: true },
    })

    const status = await readinessService.check(prisma, campana.id, tenantId, userId)
    expect(status.listaParaFacturar).toBe(true) // criteria met

    const updated = await (prisma as any).campana.findUnique({ where: { id: campana.id } })
    expect(updated.estadoComercial).toBe('CANCELADA') // state unchanged
  })
})

describe('campanas.service — validaciones de update() y confirmar()', () => {

  test('update() rechaza edición de campaña CONFIRMADA', async () => {
    const cliente = await mkCliente()
    const campana = await mkCampana(cliente.id, 'OOH', 'CONFIRMADA')

    await expect(
      campanasService.update(prisma, campana.id, { nombre: 'Nuevo nombre' }, userId),
    ).rejects.toThrow('No se puede editar una campaña confirmada')
  })

  test('confirmar() rechaza campaña sin líneas', async () => {
    const cliente = await mkCliente()
    const campana = await mkCampana(cliente.id, 'OOH', 'DRAFT')

    await expect(
      campanasService.confirmar(prisma, campana.id, userId, tenantId),
    ).rejects.toThrow('al menos una línea')
  })

  test('confirmar() crea OrdenTrabajo para OOH', async () => {
    const cliente = await mkCliente()
    const sitio = await mkSitio('OOH-CONF')
    const campana = await mkCampana(cliente.id, 'OOH', 'DRAFT')
    await mkLine(campana.id, sitio.id)

    await campanasService.confirmar(prisma, campana.id, userId, tenantId)

    const ots = await (prisma as any).ordenTrabajo.findMany({ where: { campanaId: campana.id } })
    expect(ots.length).toBeGreaterThan(0)
  })

  test('confirmar() crea TrafficOrder para DOOH', async () => {
    const cliente = await mkCliente()
    const sitio = await mkSitio('DOOH-CONF')
    await (prisma as any).sitio.update({
      where: { id: sitio.id },
      data: { tipoMedio: 'PANTALLA_DIGITAL' },
    })
    const campana = await mkCampana(cliente.id, 'DOOH', 'DRAFT')
    await mkLine(campana.id, sitio.id)

    await campanasService.confirmar(prisma, campana.id, userId, tenantId)

    const tos = await (prisma as any).trafficOrder.findMany({ where: { campanaId: campana.id } })
    expect(tos.length).toBeGreaterThan(0)
  })
})

describe('event-bus — singleton y listeners', () => {

  test('eventBus es singleton — misma instancia en todos los imports', async () => {
    const { eventBus: eb1 } = await import('../src/core/events/event-bus')
    const { eventBus: eb2 } = await import('../src/core/events/event-bus')
    expect(eb1).toBe(eb2)
  })

  test('ot.completada listener dispara readiness check', async () => {
    const cliente = await mkCliente()
    const sitio = await mkSitio('EVT-OT')
    const campana = await mkCampana(cliente.id, 'OOH', 'CONFIRMADA')
    await mkLine(campana.id, sitio.id)

    const ot = await mkOTCompletada(campana.id, sitio.id)
    await mkEvidencia(ot.id)
    await (prisma as any).campana.update({
      where: { id: campana.id },
      data: { ocRecibida: true, reportePublicacion: true },
    })

    // The app.ts listener fires readiness on ot.completada
    eventBus.emit({
      type: 'ot.completada',
      payload: { otId: ot.id, tenantId, campanaId: campana.id },
    })

    // Give async listener time to process
    await new Promise(r => setTimeout(r, 300))

    const updated = await (prisma as any).campana.findUnique({ where: { id: campana.id } })
    expect(updated.estadoComercial).toBe('LISTA_FACTURAR')
  })
})
