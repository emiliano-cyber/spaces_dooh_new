import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  AVISOS-CANAL (12/11) · `notificar()` reparte por correo SOLO lo nuevo.
//
//  La campana ya filtra los ecos del mismo día (`notificaciones-repo.dedup`).
//  El correo tiene que heredar ese filtro: si no, un doble clic que en la
//  campana no se nota mandaria dos correos iguales a todo el que lo encendio.
// ============================================================================

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: <T,>(fn: T) => fn }
})

let filas: unknown[] = []
vi.mock('./db', () => ({
  q: async () => filas,
  q1: async () => null,
  pool: { connect: vi.fn() },
  fijarTenant: vi.fn(),
}))
vi.mock('./tenant', () => ({ tenantActual: async () => 'tenant-A' }))

const avisarPorCanales = vi.fn()
vi.mock('./avisos-canales', () => ({ avisarPorCanales: (...a: unknown[]) => avisarPorCanales(...a) }))

const { notificar } = await import('./notificaciones-repo')

beforeEach(() => {
  avisarPorCanales.mockReset()
  avisarPorCanales.mockResolvedValue({ correo: 0, enviando: Promise.resolve() })
})

describe('notificar() y los canales', () => {
  it('un aviso NUEVO se reparte, con el tenant de la sesion', async () => {
    filas = [{ id: 'n1' }]
    await notificar({ tipo: 'FACTURA', nivel: 'ok', titulo: 'Factura emitida', detalle: 'F-1', link: '/finanzas' })
    expect(avisarPorCanales).toHaveBeenCalledWith('tenant-A', {
      tipo: 'FACTURA',
      titulo: 'Factura emitida',
      detalle: 'F-1',
      link: '/finanzas',
    })
  })

  it('un eco del mismo dia (no se inserto nada) NO se reparte', async () => {
    filas = []
    await notificar({ tipo: 'FACTURA', titulo: 'Factura emitida', detalle: 'F-1', link: '/finanzas' })
    expect(avisarPorCanales).not.toHaveBeenCalled()
  })

  it('si el reparto falla, la operacion que lo provoco sigue', async () => {
    filas = [{ id: 'n1' }]
    avisarPorCanales.mockRejectedValueOnce(new Error('base caida'))
    await expect(notificar({ tipo: 'PAGO', titulo: 'Abono registrado' })).resolves.toBeUndefined()
  })
})
