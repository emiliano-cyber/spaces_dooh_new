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

  // Garantiza que el tenant 'dev' → tenant_template exista
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

describe('Módulo Operaciones — flujo completo', () => {
  let token: string
  let otId: string
  let storageKey: string

  it('Login como owner del tenant dev', async () => {
    token = await login()
    expect(token).toBeTruthy()
    console.log('\n[LOGIN] token obtenido ✓')
  })

  it('PASO 1 — POST /ordenes-trabajo crea OT con folio y checklist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ordenes-trabajo',
      headers: h(token),
      payload: {
        tipo: 'MANTENIMIENTO_CORRECTIVO',
        descripcion: 'Reparación de estructura metálica en espectacular',
        instrucciones: 'Llevar soldadora y pintura anticorrosiva',
        prioridad: 'ALTA',
        checklist: [
          { texto: 'Revisar estructura' },
          { texto: 'Aplicar tratamiento anticorrosivo' },
          { texto: 'Pintura final' },
        ],
      },
    })

    expect(res.statusCode).toBe(201)
    const ot = JSON.parse(res.body)
    otId = ot.id

    console.log('\n[PASO 1] POST /ordenes-trabajo')
    console.log('  Status :', res.statusCode)
    console.log('  Folio  :', ot.folio)
    console.log('  Estatus:', ot.estatus)
    console.log('  Checklist:', JSON.stringify(ot.checklistJson))

    expect(ot.folio).toMatch(/^OT-\d{4}-\d{4}$/)
    expect(ot.estatus).toBe('PENDIENTE')
    expect(ot.checklistJson).toHaveLength(3)
    expect(ot.checklistJson[0]).toMatchObject({ id: 'item_0', completado: false })
  })

  it('PASO 2 — POST /evidencias/upload-url retorna uploadUrl y key', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/ordenes-trabajo/${otId}/evidencias/upload-url`,
      headers: h(token),
      payload: { filename: 'foto-antes.jpg', contentType: 'image/jpeg' },
    })

    expect(res.statusCode).toBe(200)
    const data = JSON.parse(res.body)
    storageKey = data.key

    console.log('\n[PASO 2] POST /evidencias/upload-url')
    console.log('  Status    :', res.statusCode)
    console.log('  uploadUrl :', data.uploadUrl.slice(0, 70) + '...')
    console.log('  key       :', data.key)

    expect(data.uploadUrl).toContain('placeholder.storage')
    expect(data.key).toContain('ots/')
    expect(data.key).toContain(otId)
    expect(data.key).toContain('foto-antes.jpg')
  })

  it('PASO 3 — POST /evidencias registra evidencia y OT pasa a EN_PROCESO', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/ordenes-trabajo/${otId}/evidencias`,
      headers: h(token),
      payload: { storageKey, lat: 19.4326, lng: -99.1332, tipo: 'FOTO' },
    })

    expect(res.statusCode).toBe(201)
    const evidencia = JSON.parse(res.body)

    console.log('\n[PASO 3] POST /evidencias')
    console.log('  Status       :', res.statusCode)
    console.log('  EvidenciaOT  :', evidencia.id)
    console.log('  storageKey   :', evidencia.storageKey)
    console.log('  tipo         :', evidencia.tipo)

    expect(evidencia.otId).toBe(otId)
    expect(evidencia.storageKey).toBe(storageKey)

    // Verificar que OT avanzó a EN_PROCESO
    const otRes = await app.inject({ method: 'GET', url: `/ordenes-trabajo/${otId}`, headers: h(token) })
    const ot = JSON.parse(otRes.body)
    console.log('  OT estatus   :', ot.estatus, '(debe ser EN_PROCESO)')
    expect(ot.estatus).toBe('EN_PROCESO')
  })

  it('PASO 4 — POST /completar → estatus COMPLETADA + evento ot.completada en consola', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/ordenes-trabajo/${otId}/completar`,
      headers: h(token),
      payload: { notas: 'Trabajo completado sin incidencias.' },
    })

    expect(res.statusCode).toBe(200)
    const ot = JSON.parse(res.body)

    console.log('\n[PASO 4] POST /completar')
    console.log('  Status         :', res.statusCode)
    console.log('  Estatus        :', ot.estatus)
    console.log('  fechaCompletada:', ot.fechaCompletada)
    console.log('  notas          :', ot.notas)
    console.log('  (el evento ot.completada se emitió arriba ↑)')

    expect(ot.estatus).toBe('COMPLETADA')
    expect(ot.fechaCompletada).toBeTruthy()
  })

  it('PASO 5 — Completar sin evidencias → 400 con mensaje correcto', async () => {
    // Crea una OT vacía
    const createRes = await app.inject({
      method: 'POST',
      url: '/ordenes-trabajo',
      headers: h(token),
      payload: { tipo: 'INSPECCION', descripcion: 'Inspección de rutina mensual del sitio' },
    })
    const otId2 = JSON.parse(createRes.body).id

    const res = await app.inject({
      method: 'POST',
      url: `/ordenes-trabajo/${otId2}/completar`,
      headers: h(token),
      payload: {},
    })

    console.log('\n[PASO 5] Completar sin evidencias')
    console.log('  Status :', res.statusCode)
    console.log('  Error  :', JSON.parse(res.body).message)

    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).message).toBe(
      'Se requiere al menos una fotografía para completar la orden',
    )
  })
})
