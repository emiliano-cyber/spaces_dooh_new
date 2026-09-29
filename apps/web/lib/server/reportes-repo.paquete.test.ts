import { describe, it, expect, vi } from 'vitest'

// ============================================================================
//  LA MARCA DEL PAQUETE VIAJA DEL SNAPSHOT AL MOTOR DEL REPORTE.
//  ADR 0039, Fase 4.
// ----------------------------------------------------------------------------
//  ⚠️ ESTE ARCHIVO NACIÓ DE UN MUTANTE QUE SOBREVIVIÓ (M27). El mutante ponía
//  `dePaquete: false` fijo en el borde de `reportes-repo.ts`, y la suite entera
//  seguía en verde: `reportes.paquete.test.ts` le pasa la marca al MOTOR a
//  mano, así que probaba el motor y no el puente que lo alimenta.
//
//  Lo que costaría: la venta de un paquete volvería a entrar en la comparación
//  «publicada vs neta» y el reporte afirmaría un descuento comercial que nadie
//  concedió — o uno NEGATIVO con un paquete premium. Un tramo de tubería sin
//  prueba entre dos extremos bien probados es exactamente donde se esconden
//  estos fallos, y no dan error: dan un número.
//
//  Se mockea `./db` y se mira lo que sale del borde. La RLS de verdad la
//  verifica `aislamiento.e2e.test.ts`, que no se toca.
// ============================================================================

const filas: Record<string, any[]> = {}

vi.mock('./db', () => ({
  q: vi.fn(async (sql: string) => {
    if (/snapshot_economico as snapshot/.test(sql)) return filas.tarifas ?? []
    return []
  }),
}))
vi.mock('./tenant', () => ({ tenantActual: vi.fn(async () => 'T1') }))
vi.mock('./config-repo', () => ({ costosOtDelTenant: vi.fn(async () => ({})) }))

const { datosRentabilidad } = await import('./reportes-repo')

const RANGO = { desde: '2026-02-01', hasta: '2026-02-28', granularidad: 'mes' as const }

/** El snapshot tal como lo congela `propuestas-repo.ts` con un paquete. */
const conPaquete = {
  campana_id: 'C1',
  snapshot: {
    esquema: 3,
    porSitio: [
      { sitioId: 'S1', lista: 45_000, neto: 22_500, paquete: true },
      { sitioId: 'S2', lista: 15_000, neto: 7_500, paquete: true },
    ],
  },
}

const sinPaquete = {
  campana_id: 'C2',
  snapshot: {
    esquema: 3,
    porSitio: [{ sitioId: 'S3', lista: 100_000, neto: 72_000 }],
  },
}

describe('la marca `paquete` del snapshot llega al motor como `dePaquete`', () => {
  it('una venta de PAQUETE llega marcada', async () => {
    filas.tarifas = [conPaquete]
    const d = await datosRentabilidad(RANGO)
    const t = d.tarifasPublicadas!.find((x) => x.campanaId === 'C1')!
    expect(t.porSitio.map((x) => x.dePaquete)).toEqual([true, true])
    // Y la lista y el neto siguen viajando: la marca no los sustituye, los
    // acompaña. El motor los necesita para poder explicar por qué NO compara.
    expect(t.porSitio[0].lista).toBe(45_000)
    expect(t.porSitio[0].neto).toBe(22_500)
  })

  it('una venta NORMAL llega SIN marcar', async () => {
    filas.tarifas = [sinPaquete]
    const d = await datosRentabilidad(RANGO)
    const t = d.tarifasPublicadas!.find((x) => x.campanaId === 'C2')!
    expect(t.porSitio[0].dePaquete).toBe(false)
  })

  it('MIXTA: la marca es POR PANTALLA, no por campaña', async () => {
    filas.tarifas = [
      {
        campana_id: 'C3',
        snapshot: {
          porSitio: [
            { sitioId: 'S1', lista: 45_000, neto: 22_500, paquete: true },
            { sitioId: 'S3', lista: 100_000, neto: 72_000 },
          ],
        },
      },
    ]
    const d = await datosRentabilidad(RANGO)
    const t = d.tarifasPublicadas!.find((x) => x.campanaId === 'C3')!
    expect(t.porSitio.map((x) => x.dePaquete)).toEqual([true, false])
  })

  it('NEGATIVA · la CADENA "false" NO marca nada', async () => {
    // Sale de una columna `jsonb` sin esquema, así que puede llegar cualquier
    // cosa. Con `!!` en vez de `=== true`, la cadena `'false'` marcaría la
    // venta y la sacaría de la comparación — bajando la cobertura del reporte
    // sin que nadie sepa por qué.
    filas.tarifas = [
      {
        campana_id: 'C4',
        snapshot: { porSitio: [{ sitioId: 'S1', lista: 100, neto: 80, paquete: 'false' }] },
      },
    ]
    const d = await datosRentabilidad(RANGO)
    expect(d.tarifasPublicadas![0].porSitio[0].dePaquete).toBe(false)
  })

  it('un snapshot que llega como CADENA también se normaliza', async () => {
    // Las filas del 08/07 en adelante no tienen por qué traer la misma forma, y
    // el driver puede entregar `jsonb` como texto. Un paquete que se perdiera
    // ahí volvería a la comparación por la puerta de atrás.
    filas.tarifas = [{ campana_id: 'C5', snapshot: JSON.stringify(conPaquete.snapshot) }]
    const d = await datosRentabilidad(RANGO)
    expect(d.tarifasPublicadas![0].porSitio.every((x) => x.dePaquete === true)).toBe(true)
  })
})
