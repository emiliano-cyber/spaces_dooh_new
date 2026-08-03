import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  Una notificación no se repite el mismo día.
//
//  En producción había dos «Campaña generada desde propuesta» de la MISMA
//  campaña —mismo detalle, mismo enlace— creadas con cuatro segundos de
//  diferencia: el evento se disparó dos veces y nada lo filtraba. El buzón
//  acumulaba ecos y se acababa ignorando entero.
//
//  Lo que se fija aquí es la FORMA de la sentencia, porque es donde está la
//  decisión: que sea UNA sola (`insert … where not exists`) y no dos pasos, y
//  que compare el detalle y el enlace con IS NOT DISTINCT FROM. Cualquiera de
//  las dos cosas al revés reabre el agujero de una manera que no se ve leyendo.
// ============================================================================

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: <T,>(fn: T) => fn }
})

let queries: { sql: string; params: unknown[] }[] = []

vi.mock('./db', () => ({
  q: async (sql: string, params: unknown[] = []) => {
    queries.push({ sql, params })
    return []
  },
  q1: async () => null,
  pool: { connect: vi.fn() },
  fijarTenant: vi.fn(),
}))
vi.mock('./tenant', () => ({
  tenantActual: async () => 'tenant-A',
  tenantDeRequest: async () => 'tenant-A',
}))

const { notificar } = await import('./notificaciones-repo')

const sql = () => queries[0]?.sql ?? ''
const norm = () => sql().replace(/\s+/g, ' ').toLowerCase()

beforeEach(() => {
  queries = []
})

describe('notificar() no repite el mismo aviso en el día', () => {
  it('inserta condicionado, no a secas', async () => {
    await notificar({ tipo: 'CAMPANA', titulo: 'Campaña generada', detalle: 'F-1', link: '/c/1' })
    expect(queries).toHaveLength(1)
    expect(norm()).toContain('where not exists')
    // `insert … values` a secas es justo lo que dejaba pasar el duplicado.
    expect(norm()).not.toMatch(/insert into notificaciones \([^)]*\) values/)
  })

  it('va en UNA sentencia: consultar y luego insertar deja pasar el doble clic', async () => {
    await notificar({ tipo: 'CAMPANA', titulo: 'Campaña generada', detalle: 'F-1', link: '/c/1' })
    // Dos peticiones simultáneas —el caso real— pasarían las dos una
    // comprobación previa antes de que ninguna hubiera insertado.
    expect(queries).toHaveLength(1)
  })

  it('acota la ventana al día en curso', async () => {
    await notificar({ tipo: 'X', titulo: 'Y' })
    expect(norm()).toContain("date_trunc('day', now())")
  })

  it('compara detalle y enlace con IS NOT DISTINCT FROM, no con =', async () => {
    // Con "=", un detalle NULL da NULL (nunca verdadero) y el duplicado se
    // colaría justo en los avisos que no llevan detalle.
    await notificar({ tipo: 'X', titulo: 'Y' })
    expect(norm()).toContain('detalle is not distinct from')
    expect(norm()).toContain('link is not distinct from')
  })

  it('distingue por tipo, título, detalle y enlace: dos campañas distintas SÍ avisan', async () => {
    await notificar({ tipo: 'CAMPANA', titulo: 'Campaña generada', detalle: 'F-2', link: '/c/2' })
    const n = norm()
    for (const col of ['tipo', 'titulo', 'detalle', 'link']) expect(n).toContain(col)
    expect(queries[0].params).toEqual(
      expect.arrayContaining(['CAMPANA', 'Campaña generada', 'F-2', '/c/2', 'tenant-A']),
    )
  })

  it('acota por tenant: el aviso de una organización no tapa el de otra', async () => {
    await notificar({ tipo: 'X', titulo: 'Y' })
    expect(norm()).toContain('tenant_id =')
  })

  it('sigue sin romper la operación principal si la BD falla', async () => {
    const mod = await import('./db')
    const original = mod.q
    // Se sustituye a propósito para simular el fallo: un aviso que no se puede
    // guardar nunca debe tumbar la venta o el alta que lo disparó.
    ;(mod as { q: unknown }).q = async () => { throw new Error('BD caída') }
    await expect(notificar({ tipo: 'X', titulo: 'Y' })).resolves.toBeUndefined()
    ;(mod as { q: unknown }).q = original
  })
})
