import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { app } from '../src/app'
import { disconnectAll } from '../src/db/client'

const H = (tok: string) => ({ 'content-type': 'application/json', 'x-tenant-slug': 'dev', authorization: `Bearer ${tok}` })

let tok: string

beforeAll(async () => {
  await app.ready()
  const lr = await app.inject({ method: 'POST', url: '/auth/login', headers: { 'content-type': 'application/json', 'x-tenant-slug': 'dev' }, payload: { email: 'owner@dev.com', password: 'DevPass123!' } })
  tok = JSON.parse(lr.body).accessToken
})

afterAll(async () => { await app.close(); await disconnectAll() })

describe('Verificación queries del frontend', () => {

  it('DASHBOARD — GET /ordenes-trabajo?limit=1000 retorna KPIs calculables', async () => {
    const res = await app.inject({ method: 'GET', url: '/ordenes-trabajo?limit=1000', headers: H(tok) })
    expect(res.statusCode).toBe(200)
    const d = JSON.parse(res.body)
    const ots = d.data as any[]

    const activas   = ots.filter(o => o.estatus !== 'COMPLETADA' && o.estatus !== 'CANCELADA')
    const urgentes  = ots.filter(o => o.prioridad === 'URGENTE' && o.estatus !== 'COMPLETADA')
    const sinAsgn   = ots.filter(o => o.estatus === 'PENDIENTE')

    console.log(`\n  Total OTs en DB : ${d.meta.total}`)
    console.log(`  KPI activas     : ${activas.length}`)
    console.log(`  KPI urgentes    : ${urgentes.length}`)
    console.log(`  KPI sin asignar : ${sinAsgn.length}`)
    console.log(`  Folios muestra  : ${ots.slice(0,3).map((o:any)=>o.folio).join(', ')}`)

    expect(d.meta).toHaveProperty('total')
    expect(Array.isArray(ots)).toBe(true)
    expect(ots.length).toBeGreaterThan(0)
    expect(ots[0]).toHaveProperty('folio')
    expect(ots[0]).toHaveProperty('prioridad')
    expect(ots[0]).toHaveProperty('estatus')
  })

  it('LISTA — GET /ordenes-trabajo paginado con filtro estatus', async () => {
    const res = await app.inject({ method: 'GET', url: '/ordenes-trabajo?page=1', headers: H(tok) })
    expect(res.statusCode).toBe(200)
    const d = JSON.parse(res.body)

    console.log(`\n  Total OTs       : ${d.meta.total}`)
    console.log(`  Página          : ${d.meta.page}/${d.meta.pages}`)
    console.log(`  OTs en página   : ${d.data.length}`)
    console.log(`  Folios          : ${d.data.slice(0,4).map((o:any)=>o.folio).join(', ')}`)
    d.data.slice(0,2).forEach((o:any) => {
      console.log(`    ${o.folio}  prioridad=${o.prioridad}  estatus=${o.estatus}`)
    })

    expect(d.meta.page).toBe(1)
    expect(d.data.length).toBeGreaterThan(0)
    expect(d.data[0]).toHaveProperty('_count')
  })

  it('FORMULARIO — POST /ordenes-trabajo crea OT y devuelve id para redirect', async () => {
    const res = await app.inject({
      method: 'POST', url: '/ordenes-trabajo', headers: H(tok),
      payload: { tipo: 'INSPECCION', descripcion: 'Verificación semestral de estructura y pintura', prioridad: 'ALTA' }
    })
    expect(res.statusCode).toBe(201)
    const ot = JSON.parse(res.body)

    console.log(`\n  Status          : ${res.statusCode}`)
    console.log(`  Folio generado  : ${ot.folio}`)
    console.log(`  ID (redirect)   : ${ot.id}`)
    console.log(`  Redirect URL    : /operaciones/ordenes/${ot.id}`)
    console.log(`  Estatus inicial : ${ot.estatus}`)
    console.log(`  Checklist       : ${JSON.stringify(ot.checklistJson)}`)

    expect(ot.folio).toMatch(/^OT-\d{4}-\d{4}$/)
    expect(ot.id).toBeTruthy()
    expect(ot.estatus).toBe('PENDIENTE')
  })
})
