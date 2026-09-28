import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  LA REJILLA VIAJA CON LA PANTALLA. Y esta prueba la escribió un mutante.
// ----------------------------------------------------------------------------
//  EL DEFECTO QUE VIGILA, que sobrevivió a la primera tanda de mutación y por
//  eso está aquí: si `rowToSitio` dejara de mapear `sitio_tarifas`, TODO
//  seguiría en verde y la aplicación **cotizaría la tarifa base en vez de la
//  del prime**. No hay error, no hay pantalla rota, no hay 500: hay una
//  cotización más barata de lo que el dueño decidió cobrar, y nadie la ve
//  hasta que alguien compara una factura con una tabla de precios.
//
//  El cotizador de propuestas resuelve el precio EN EL CLIENTE con `s.rejilla`
//  (`app/(app)/(shell)/propuestas/page.tsx`, `tarifaDe`). Sin ese campo,
//  `resolverTarifa` no encuentra ninguna fila y devuelve la base — que es
//  exactamente su comportamiento correcto para una pantalla sin rejilla. Por
//  eso el fallo es indistinguible del caso normal, y por eso hay que fijarlo
//  aquí y no confiar en que se note.
//
//  Se mockea `./db` y se mira lo que sale de `getSitio`, igual que
//  `sitios-repo.modalidades.test.ts`.
// ============================================================================

const consultas: { sql: string; params: unknown[] }[] = []

const FILAS_REJILLA = [
  { unidad: 'spot', franja_id: 'F-PRIME', temporada_id: null, tarifa_publicada: '1800.00' },
  { unidad: 'spot', franja_id: null, temporada_id: 'T-BF', tarifa_publicada: '1200.00' },
]

const db = {
  pool: { connect: vi.fn() },
  q: vi.fn(async (sql: string, params?: unknown[]): Promise<any[]> => {
    consultas.push({ sql, params: params ?? [] })
    if (/from sitio_tarifas/.test(sql)) return FILAS_REJILLA
    if (/from sitio_modalidades/.test(sql)) {
      return [{ unidad: 'spot', tarifa_publicada: '1000.00', costo_compra: '0' }]
    }
    return []
  }),
  q1: vi.fn(async (): Promise<any> => ({ id: 'S1', nombre: 'Pantalla', tenant_id: 'T1' })),
  fijarTenant: vi.fn(),
  fijarTenantExplicito: vi.fn(),
  withTenantTx: vi.fn(),
}
vi.mock('./db', () => db)
vi.mock('./tenant', () => ({ tenantActual: vi.fn(async () => 'T1') }))

const { getSitio, rowToSitio } = await import('./sitios-repo')

beforeEach(() => {
  consultas.length = 0
  vi.clearAllMocks()
  db.q.mockImplementation(async (sql: string, params?: unknown[]): Promise<any[]> => {
    consultas.push({ sql, params: params ?? [] })
    if (/from sitio_tarifas/.test(sql)) return FILAS_REJILLA
    if (/from sitio_modalidades/.test(sql)) {
      return [{ unidad: 'spot', tarifa_publicada: '1000.00', costo_compra: '0' }]
    }
    return []
  })
  db.q1.mockResolvedValue({ id: 'S1', nombre: 'Pantalla', tenant_id: 'T1' })
})

describe('1 · `getSitio` trae la rejilla', () => {
  it('la consulta a `sitio_tarifas` sale, y filtrada por el sitio', async () => {
    await getSitio('S1')
    const sel = consultas.map((c) => c.sql.replace(/\s+/g, ' ')).find((s) => /from sitio_tarifas/.test(s))
    expect(sel, 'no se consultó `sitio_tarifas`').toBeDefined()
    expect(sel).toMatch(/where sitio_id\s*=\s*\$1/)
  })

  it('la rejilla llega al objeto con las CUATRO piezas que necesita el cotizador', async () => {
    const s = await getSitio('S1')
    expect(s.rejilla).toEqual([
      { unidad: 'spot', franjaId: 'F-PRIME', temporadaId: null, tarifa: 1800 },
      { unidad: 'spot', franjaId: null, temporadaId: 'T-BF', tarifa: 1200 },
    ])
  })

  it('la tarifa llega como NÚMERO, no como la cadena que devuelve `pg`', async () => {
    // `numeric` sale del driver como string. Un `'1800.00'` sin convertir
    // compararía y sumaría mal, y `1800.00 > 999` sería falso por comparación
    // de cadenas — sin ningún error.
    const s = await getSitio('S1')
    expect(typeof s.rejilla[0].tarifa).toBe('number')
  })
})

describe('2 · el caso normal: una pantalla SIN rejilla', () => {
  it('devuelve `rejilla: []`, no `undefined` — invariante 1', async () => {
    // Vacía tiene que ser un array vacío y no un hueco: `(s.rejilla ?? [])` en
    // el cotizador ya lo cubre, pero el contrato explícito es lo que impide que
    // una pantalla se quede sin precio por un `.filter` sobre `undefined`.
    const s = rowToSitio({ id: 'S1', nombre: 'Pantalla' }, [], true, [])
    expect(s.rejilla).toEqual([])
  })

  it('la tarifa base sigue saliendo por `modalidadesDetalle`, intacta', async () => {
    const s = await getSitio('S1')
    expect(s.modalidadesDetalle).toEqual([
      { unidad: 'spot', tarifaPublicada: 1000, costoCompra: 0 },
    ])
  })
})
