import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  Los LISTADOS de pantallas no leen las fotos de Postgres.
// ----------------------------------------------------------------------------
//  Medido en g500 el 12/10: una sola pantalla con 10.4 MB de fotos en base64
//  hacía que `/api/sitios` tardara 3.1 s fijos y `/api/estado` 7 s, porque
//  `select s.*` las sacaba de Postgres en cada listado —dos veces en el estado,
//  `sitios` y `sitiosRed`— aunque `rowToSitio(…, conMedia=false)` las tirara
//  después. En local, la misma pantalla: 1069 ms con `s.*`, 1 ms sin las fotos.
//
//  La e2e `hidratacion-ligera` mira lo que SALE por la API, y eso ya era ligero:
//  no puede ver lo que viaja de Postgres a Node. Por eso esto mira el SQL.
// ============================================================================

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: <T,>(fn: T) => fn }
})

const consultas: string[] = []
// El catálogo se lee una vez por proceso: se guarda aparte para no perderlo.
const delCatalogo: string[] = []
vi.mock('./db', () => ({
  q: vi.fn(async (sql: string) => {
    consultas.push(sql)
    // La lectura del catálogo devuelve la lista ya armada, como Postgres.
    if (sql.includes('pg_attribute')) {
      delCatalogo.push(sql)
      return [{ c: 's."id", s."nombre"' }]
    }
    return []
  }),
  q1: vi.fn(),
  pool: {},
  fijarTenant: vi.fn(),
  withTenantTx: vi.fn(),
}))
vi.mock('./tenant', () => ({ tenantActual: async () => 'tenant-1' }))

const { listarSitios, listarSitiosRed } = await import('./sitios-repo')

const delListado = () => consultas.find((s) => /from sitios s/.test(s))!

describe.each([
  ['listarSitios', listarSitios],
  ['listarSitiosRed', listarSitiosRed],
])('%s', (_n, listar) => {
  beforeEach(() => {
    consultas.length = 0
  })

  it('no pide `s.*`', async () => {
    await listar()
    expect(delListado()).not.toMatch(/s\.\*/)
  })

  it('solo toca `fotos` para medirlas, sin leerlas', async () => {
    await listar()
    const sql = delListado()
    // `pg_column_size` lee el tamaño del puntero TOAST, no el contenido.
    const sinMedir = sql.replace(/pg_column_size\(s\.fotos\)/g, '')
    expect(sinMedir).not.toMatch(/\bfotos\b/)
    expect(sinMedir).not.toMatch(/imagen_promocional/)
    expect(sql).toMatch(/as tiene_fotos/)
  })
})

describe('la lista de columnas', () => {
  it('sale del catálogo y deja fuera la media, sin escribirla a mano', async () => {
    consultas.length = 0
    await listarSitios()
    expect(delCatalogo).toHaveLength(1)
    expect(delCatalogo[0]).toMatch(/not in \('fotos', 'imagen_promocional'\)/)
    expect(delListado()).toContain('s."id", s."nombre"')
  })
})
