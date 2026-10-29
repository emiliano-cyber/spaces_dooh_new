import { describe, it, expect, vi } from 'vitest'

// ============================================================================
//  B42 (2026-10-29) · LA FRANJA VIAJA DEL SNAPSHOT Y DE LA RESERVA AL MOTOR.
// ----------------------------------------------------------------------------
//  El motor del reporte (`lib/data/reportes.ts`) desempata ahora la tarifa
//  publicada por (pantalla, franja). Eso solo sirve si el BORDE se la pasa: el
//  snapshot congela `porSitio[].franja.id` desde la Fase 1 y la reserva hereda
//  `franja_id` del ítem, y hasta hoy ninguno de los dos llegaba al motor.
//
//  Es la lección de `reportes-repo.paquete.test.ts` (el mutante M27): un tramo
//  de tubería sin prueba entre dos extremos bien probados es donde se esconde
//  el fallo, y no da error — da una cobertura más baja que nadie explica.
// ============================================================================

const filas: Record<string, any[]> = {}
const consultas: string[] = []

vi.mock('./db', () => ({
  q: vi.fn(async (sql: string) => {
    consultas.push(sql)
    if (/snapshot_economico as snapshot/.test(sql)) return filas.tarifas ?? []
    if (/from reservas/.test(sql)) return filas.reservas ?? []
    return []
  }),
}))
vi.mock('./tenant', () => ({ tenantActual: vi.fn(async () => 'T1') }))
vi.mock('./config-repo', () => ({ costosOtDelTenant: vi.fn(async () => ({})) }))

const { datosRentabilidad } = await import('./reportes-repo')

const RANGO = { desde: '2026-02-01', hasta: '2026-02-28', granularidad: 'mes' as const }

describe('B42 · la franja llega al motor', () => {
  it('el snapshot pasa `franjaId` por pantalla; sin franja, `null`', async () => {
    filas.tarifas = [
      {
        campana_id: 'C1',
        snapshot: {
          porSitio: [
            { sitioId: 'S1', lista: 1800, neto: 1800, franja: { id: 'F-PRIME', nombre: 'Prime' } },
            { sitioId: 'S1', lista: 600, neto: 600, franja: { id: 'F-MADRUGADA', nombre: 'Madrugada' } },
            { sitioId: 'S2', lista: 900, neto: 900, franja: null },
          ],
        },
      },
    ]
    const d = await datosRentabilidad(RANGO)
    const t = d.tarifasPublicadas!.find((x) => x.campanaId === 'C1')!
    expect(t.porSitio.map((x) => x.franjaId)).toEqual(['F-PRIME', 'F-MADRUGADA', null])
  })

  it('un snapshot ANTERIOR a la Fase 1 (sin `franja`) llega con `franjaId: null`', async () => {
    filas.tarifas = [{ campana_id: 'C2', snapshot: { porSitio: [{ sitioId: 'S3', lista: 100, neto: 72 }] } }]
    const d = await datosRentabilidad(RANGO)
    expect(d.tarifasPublicadas![0].porSitio[0].franjaId).toBeNull()
  })

  it('la reserva trae su `franja_id`, y llega como `franjaId`', async () => {
    filas.reservas = [
      { sitio_id: 'S1', campana_id: 'C1', precio: '1800', estatus: 'CONFIRMADA', fecha_inicio: '2026-02-01', fecha_fin: '2026-02-28', franja_id: 'F-PRIME' },
      { sitio_id: 'S2', campana_id: 'C1', precio: '900', estatus: 'CONFIRMADA', fecha_inicio: '2026-02-01', fecha_fin: '2026-02-28', franja_id: null },
    ]
    const d = await datosRentabilidad(RANGO)
    expect(d.reservas.map((r: any) => r.franjaId)).toEqual(['F-PRIME', null])
    const sel = consultas.find((s) => /from reservas/.test(s))!
    expect(sel).toMatch(/franja_id/)
  })
})
