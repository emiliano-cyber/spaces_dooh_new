import { describe, it, expect, vi } from 'vitest'
import type { PoolClient } from 'pg'

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: <T,>(fn: T) => fn }
})

const { cupoEfectivo, excedeCupoClientes, cupoGlobalClientes } = await import('./campanas-repo')

// ============================================================================
//  ADR 0008 · cupo de clientes por pantalla.
//  La decisión (¿sobra este cliente?) vive aislada de la BD justo para poder
//  probarla sin levantar Postgres. Lo que se ancla aquí:
//   · sin cupo configurado no se bloquea NADA (la regla nace apagada);
//   · un cliente que ya está en la pantalla nunca sobra, aunque esté llena;
//   · el cupo del sitio manda sobre el default global.
// ============================================================================

const ocupantes = (...ids: string[]) => ids.map((cliente_id) => ({ cliente_id }))

function fakeClient(rows: Record<string, unknown>[]) {
  return {
    query: async () => ({ rows }),
  } as unknown as PoolClient
}

describe('cupoEfectivo — el de la pantalla manda sobre el global', () => {
  it('usa el de la pantalla cuando lo tiene', () => {
    expect(cupoEfectivo(6, 4)).toBe(6)
    expect(cupoEfectivo(1, null)).toBe(1)
  })

  it('cae al global cuando la pantalla no tiene el suyo', () => {
    expect(cupoEfectivo(null, 4)).toBe(4)
    expect(cupoEfectivo(undefined, 4)).toBe(4)
  })

  it('sin ninguno de los dos, no hay límite', () => {
    expect(cupoEfectivo(null, null)).toBeNull()
  })

  it('acepta el valor tal como lo devuelve pg (string en numeric/int8)', () => {
    expect(cupoEfectivo('4', null)).toBe(4)
  })
})

describe('excedeCupoClientes', () => {
  it('sin cupo configurado no bloquea: la regla nace apagada', () => {
    expect(
      excedeCupoClientes({ cupo: null, ocupantes: ocupantes('a', 'b', 'c', 'd', 'e'), clienteId: 'z' }),
    ).toBe(false)
  })

  it('bloquea al cliente NUEVO cuando el cupo está lleno', () => {
    expect(
      excedeCupoClientes({ cupo: 4, ocupantes: ocupantes('a', 'b', 'c', 'd'), clienteId: 'z' }),
    ).toBe(true)
  })

  it('NO bloquea a un cliente que ya está en la pantalla, aunque esté llena', () => {
    // Es el caso que motiva la regla: el anunciante fiel que renueva o mete una
    // segunda campaña no debe chocar contra su propio cupo.
    expect(
      excedeCupoClientes({ cupo: 4, ocupantes: ocupantes('a', 'b', 'c', 'd'), clienteId: 'c' }),
    ).toBe(false)
  })

  it('deja pasar mientras quede lugar', () => {
    expect(
      excedeCupoClientes({ cupo: 4, ocupantes: ocupantes('a', 'b', 'c'), clienteId: 'z' }),
    ).toBe(false)
  })

  it('cupo 1: la pantalla queda para un solo anunciante', () => {
    expect(excedeCupoClientes({ cupo: 1, ocupantes: ocupantes('a'), clienteId: 'z' })).toBe(true)
    expect(excedeCupoClientes({ cupo: 1, ocupantes: ocupantes('a'), clienteId: 'a' })).toBe(false)
    expect(excedeCupoClientes({ cupo: 1, ocupantes: [], clienteId: 'z' })).toBe(false)
  })

  it('sin cliente resuelto se trata como nuevo: no se cuela por un dato faltante', () => {
    expect(
      excedeCupoClientes({ cupo: 2, ocupantes: ocupantes('a', 'b'), clienteId: null }),
    ).toBe(true)
  })

  it('pantalla vacía nunca bloquea', () => {
    expect(excedeCupoClientes({ cupo: 1, ocupantes: [], clienteId: null })).toBe(false)
  })
})

describe('cupoGlobalClientes', () => {
  it('devuelve el número configurado', async () => {
    expect(await cupoGlobalClientes(fakeClient([{ max_clientes_pantalla: 4 }]))).toBe(4)
  })

  it('null cuando no está configurado: sin límite', async () => {
    expect(await cupoGlobalClientes(fakeClient([{ max_clientes_pantalla: null }]))).toBeNull()
  })

  it('null cuando no hay fila de configuración todavía', async () => {
    expect(await cupoGlobalClientes(fakeClient([]))).toBeNull()
  })
})
