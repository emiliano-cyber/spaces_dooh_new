import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  SEG-21OCT — `cerrarOtrasSesionesDeUsuario` borra TODAS las sesiones de la
//  persona menos la que se le pasa.
// ----------------------------------------------------------------------------
//  Va por `qRaw`, igual que `cerrarSesionesDeUsuario`: `sesiones` está exenta
//  de la RLS fail-closed (es pre-sesión), y con `q` el GUC de tenant no cambia
//  nada. Lo que se fija aquí es la FORMA de la sentencia, porque un fallo en
//  ella no da error: `token <> $2` con un `$2` nulo no borra NINGUNA fila
//  (`x <> null` es null, no true), y la persona creería que cerró las demás.
//  Por eso `is distinct from`.
// ============================================================================

const { qRaw } = vi.hoisted(() => ({ qRaw: vi.fn(async (..._a: unknown[]) => [{ token: 'a' }, { token: 'b' }]) }))
vi.mock('./db', () => ({
  pool: { connect: vi.fn() },
  q: vi.fn(async () => []),
  q1: vi.fn(async () => null),
  qConTenant: vi.fn(async () => []),
  qRaw,
  qRaw1: vi.fn(async () => null),
  fijarTenantExplicito: vi.fn(),
}))
vi.mock('./tenant', () => ({ tenantActual: vi.fn(async () => 'T1') }))

import { cerrarOtrasSesionesDeUsuario } from './usuarios-repo'

beforeEach(() => qRaw.mockClear())

describe('cerrarOtrasSesionesDeUsuario', () => {
  it('borra las del usuario salvo la actual, y dice cuántas', async () => {
    const n = await cerrarOtrasSesionesDeUsuario('U1', 'TOKEN-ACTUAL')
    expect(n).toBe(2)
    const [sql, params] = qRaw.mock.calls[0] as [string, unknown[]]
    expect(sql).toMatch(/delete from sesiones/i)
    expect(sql).toMatch(/usuario_id\s*=\s*\$1/)
    expect(sql).toMatch(/token\s+is\s+distinct\s+from\s+\$2/i)
    expect(params).toEqual(['U1', 'TOKEN-ACTUAL'])
  })

  it('sin token actual, borra todas (no se queda sin borrar ninguna)', async () => {
    await cerrarOtrasSesionesDeUsuario('U1', undefined)
    const [, params] = qRaw.mock.calls[0] as [string, unknown[]]
    expect(params).toEqual(['U1', null])
  })
})
