import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, poolTest, cerrarPool, comoTenant } from './db-e2e'
import { sembrarTenant, asegurarPermisos, enDias } from './semillas-e2e'

// ============================================================================
//  Que las semillas produzcan lo que las demás pruebas dan por hecho.
//
//  Va aparte porque un fallo aquí explica el fallo de todas las demás: si el
//  contrato no nace COMPLETO, el flujo entero se cae en el primer `reservar`
//  por el ADR 0003, y el sintoma apunta al sitio equivocado.
// ============================================================================

let a: Awaited<ReturnType<typeof sembrarTenant>>

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  a = await sembrarTenant('alfa')
}, 60_000)

afterAll(async () => {
  await cerrarPool()
})

describe('semillas', () => {
  it('la organización queda con su usuario, su pantalla y su cliente', async () => {
    expect(a.id).toBeTruthy()
    const datos = await comoTenant(a.id, async (q) => ({
      usuarios: (await q('select count(*)::int n from usuarios'))[0].n,
      sitios: (await q('select count(*)::int n from sitios'))[0].n,
      clientes: (await q('select count(*)::int n from clientes'))[0].n,
      config: (await q('select count(*)::int n from config_negocio'))[0].n,
    }))
    expect(datos).toEqual({ usuarios: 1, sitios: 1, clientes: 1, config: 1 })
  })

  it('el contrato nace COMPLETO, así que la pantalla se puede reservar', async () => {
    // ADR 0003: con el contrato en INCOMPLETO o CANCELADO, reservar falla. Si
    // esta prueba se pone roja, el flujo critico fallara por un motivo que no
    // es el que se esta probando.
    const estatus = await comoTenant(a.id, async (q) =>
      (await q('select estatus from contratos_arrendamiento'))[0].estatus,
    )
    expect(['VIGENTE', 'POR_VENCER', 'RENOVADO']).toContain(estatus)
  })

  it('las fechas del contrato son relativas a hoy, no literales', async () => {
    // Con fechas fijas la suite se pudre sola: dentro de un año el contrato
    // estaria vencido y el flujo fallaria por el calendario.
    const c = await comoTenant(a.id, async (q) =>
      (await q('select fecha_inicio, fecha_fin from contratos_arrendamiento'))[0],
    )
    const hoy = new Date().toISOString().slice(0, 10)
    expect(c.fecha_inicio.toISOString().slice(0, 10) < hoy).toBe(true)
    expect(c.fecha_fin.toISOString().slice(0, 10) > hoy).toBe(true)
  })

  it('dos organizaciones sembradas no se ven entre sí', async () => {
    const b = await sembrarTenant('beta')
    const sitiosDeA = await comoTenant(a.id, async (q) =>
      (await q('select count(*)::int n from sitios'))[0].n,
    )
    const sitiosDeB = await comoTenant(b.id, async (q) =>
      (await q('select count(*)::int n from sitios'))[0].n,
    )
    // Cada una ve UNA: la suya. Si viera dos, la RLS no estaria aislando y
    // todas las pruebas de aislamiento pasarian por casualidad.
    expect([sitiosDeA, sitiosDeB]).toEqual([1, 1])
  })

  it('`enDias` produce fechas ISO manejables', () => {
    expect(enDias(0)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(enDias(10) > enDias(0)).toBe(true)
    expect(enDias(-10) < enDias(0)).toBe(true)
  })
})
