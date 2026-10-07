import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  Las dos vigencias de `password_resets` (ADR 0044).
// ----------------------------------------------------------------------------
//  Recuperar y invitar escriben la MISMA tabla, sin columna que las distinga:
//  lo único que cambia es `expira_en`. Si la invitación heredara la hora de la
//  recuperación, una persona que abre el correo al día siguiente encontraría el
//  enlace vencido y nada diría por qué. Y si la recuperación heredara las 72 h,
//  un enlace robado del buzón serviría tres días.
//
//  La base se simula: aquí se mide QUÉ se escribe. Que la escritura pase la RLS
//  lo prueba `invitacion-usuario.e2e.test.ts` contra Postgres real.
// ============================================================================

const qConTenant = vi.fn(async (..._a: unknown[]) => [])
const qRaw1 = vi.fn()
vi.mock('./db', () => ({
  qConTenant: (...a: unknown[]) => qConTenant(...a),
  qRaw1: (...a: unknown[]) => qRaw1(...a),
  qRaw: vi.fn(),
}))
vi.mock('./tenant', () => ({ tenantActual: async () => 't-1' }))

const { crearReset, crearInvitacion } = await import('./password-reset-repo')

const HORA = 60 * 60_000

function expiraEscrita(): number {
  const [, , params] = qConTenant.mock.calls[0] as [string, string, unknown[]]
  return new Date(params[3] as string).getTime() - Date.now()
}

beforeEach(() => {
  vi.clearAllMocks()
  qRaw1.mockResolvedValue({ id: 'u-1', nombre: 'Ana', email: 'ana@x.mx', activo: true, tenant_id: 't-1' })
})

describe('vigencia de los enlaces', () => {
  it('la recuperación vence en 1 hora', async () => {
    await crearReset('ana@x.mx')
    const ms = expiraEscrita()
    expect(ms).toBeGreaterThan(HORA - 5_000)
    expect(ms).toBeLessThanOrEqual(HORA)
  })

  it('la invitación vence en 72 horas', async () => {
    await crearInvitacion('u-1')
    const ms = expiraEscrita()
    expect(ms).toBeGreaterThan(72 * HORA - 5_000)
    expect(ms).toBeLessThanOrEqual(72 * HORA)
  })

  it('la invitación se escribe con el tenant de la SESIÓN, en columna y en contexto', async () => {
    await crearInvitacion('u-1')
    const [tenant, sql, params] = qConTenant.mock.calls[0] as [string, string, unknown[]]
    expect(tenant).toBe('t-1')
    expect(sql).toMatch(/insert into password_resets/)
    expect(params[1]).toBe('u-1')
    expect(params[2]).toBe('t-1')
  })
})
