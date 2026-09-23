import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, poolTest, cerrarPool } from '@/lib/test/db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from '@/lib/test/semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from '@/lib/test/servidor-e2e'

describe('tabla tickets', () => {
  beforeAll(async () => { await recrearEsquema() })

  it('existe, tiene tenant_id y RLS encendida', async () => {
    const p = poolTest()
    const { rows } = await p.query(
      `select relrowsecurity from pg_class where relname = 'tickets'`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].relrowsecurity).toBe(true)
  })

  it('tiene la politica tenant_isolation', async () => {
    const p = poolTest()
    const { rows } = await p.query(
      `select policyname from pg_policies where tablename = 'tickets'`,
    )
    expect(rows.map((r) => r.policyname)).toContain('tenant_isolation')
  })
})

// ============================================================================
//  Tarea 5 · GET/POST /api/tickets — la ruta del CLIENTE.
// ----------------------------------------------------------------------------
//  El aislamiento entre organizaciones se demuestra aquí, por HTTP, y no en las
//  unitarias del repo/controlador: las unitarias simulan la base y ya se han
//  visto pasar con la RLS rota (vault/06-Operacion/zonas-de-riesgo.md, R2).
// ============================================================================
describe('GET/POST /api/tickets — la ruta del cliente', () => {
  let alfa: Awaited<ReturnType<typeof sembrarTenant>>
  let beta: Awaited<ReturnType<typeof sembrarTenant>>
  let cAlfa: Cliente
  let cBeta: Cliente

  beforeAll(async () => {
    await recrearEsquema()
    await asegurarPermisos()
    alfa = await sembrarTenant('tka')
    beta = await sembrarTenant('tkb')
    // COMERCIAL no tiene el módulo `administracion` en absoluto
    // (semillas-e2e.ts:asegurarPermisos) — es el escenario real para el 403,
    // no uno supuesto.
    await sembrarTenant('tkc', { rol: 'COMERCIAL' })

    await arrancarServidor()
    cAlfa = new Cliente()
    cBeta = new Cliente()
    await cAlfa.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
    await cBeta.entrar(beta.usuarioEmail, PASSWORD_DEMO)
  }, 180_000)

  afterAll(async () => {
    await pararServidor()
    await cerrarPool()
  })

  it('un tenant NO ve los tickets del otro', async () => {
    const altaAlfa = await cAlfa.pedir('/api/tickets/', {
      cuerpo: { asunto: 'Solo de alfa', cuerpo: 'El detalle del problema de alfa' },
    })
    expect(altaAlfa.status, JSON.stringify(altaAlfa.datos)).toBe(201)

    const altaBeta = await cBeta.pedir('/api/tickets/', {
      cuerpo: { asunto: 'Solo de beta', cuerpo: 'El detalle del problema de beta' },
    })
    expect(altaBeta.status, JSON.stringify(altaBeta.datos)).toBe(201)

    const listaAlfa = await cAlfa.pedir('/api/tickets/')
    const listaBeta = await cBeta.pedir('/api/tickets/')
    expect(listaAlfa.status).toBe(200)
    expect(listaBeta.status).toBe(200)

    const asuntosAlfa = (listaAlfa.datos as Array<{ asunto: string }>).map((t) => t.asunto)
    const asuntosBeta = (listaBeta.datos as Array<{ asunto: string }>).map((t) => t.asunto)
    expect(asuntosAlfa).toContain('Solo de alfa')
    expect(asuntosAlfa).not.toContain('Solo de beta')
    expect(asuntosBeta).toContain('Solo de beta')
    expect(asuntosBeta).not.toContain('Solo de alfa')

    // Ningún ticket del cliente lleva `tenantId`: ya sabe de quién es
    // (tickets-repo.ts:36, filaATicket).
    expect(listaAlfa.datos[0]).not.toHaveProperty('tenantId')
  })

  it('sin sesion da 401', async () => {
    const anonimo = new Cliente()
    const r = await anonimo.pedir('/api/tickets/')
    expect(r.status).toBe(401)
  })

  it('sin permiso de administracion da 403', async () => {
    const comercial = new Cliente()
    await comercial.entrar('duenio@tkc.test', PASSWORD_DEMO)
    const r = await comercial.pedir('/api/tickets/')
    expect(r.status).toBe(403)
  })
})
