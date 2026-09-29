import { describe, it, expect } from 'vitest'
import { costoEfectivoDeOt, tieneCostoReal, COSTOS_OT_RESPALDO } from './costos-ot'
import { dashboardMetrics, margenCampana } from './data/derive'

// ============================================================================
//  OT-COSTO-01 · la regla «el costo real SUSTITUYE la estimación» se declara
//  UNA sola vez, y la usan LOS TRES que calculan margen.
// ----------------------------------------------------------------------------
//  Encontrado revisando el propio cambio, no leyendo la tarea: al meter
//  `costo_real` solo en el motor de reportes, el **dashboard del dueño** y el
//  **P&L por campaña** (`derive.ts`) seguían cobrando la tarifa por tipo. Con una
//  OT de 12 000 capturada, el reporte decía 12 000 y el dashboard 1 500 **para
//  la misma orden**, sin ningún error.
//
//  Eso es exactamente el fallo que `lib/costos-ot.ts` existe para no tener — su
//  propia cabecera dice que vive FUERA de `lib/server/` para que el dashboard y
//  el reporte no den dos márgenes distintos— y el comentario de
//  `derive.ts:749-751` ya lo había escrito con todas las letras sobre la
//  constante vieja:
//
//    «Si aquí se quedara la constante, el margen de una campaña y el del mes
//     dejarían de cuadrar entre sí sin que nada fallara.»
//
//  Por eso la regla no se escribe tres veces: se declara aquí y se importa.
// ============================================================================

const ot = (over: Record<string, unknown> = {}) => ({
  id: 'OT1',
  tipo: 'HERRERIA',
  estatus: 'PENDIENTE',
  sitioId: 'S1',
  campanaId: 'C1',
  costoReal: null,
  ...over,
})

describe('1 · la regla, declarada una sola vez', () => {
  it('sin costo capturado vale la estimación por tipo', () => {
    expect(costoEfectivoDeOt(ot(), null)).toBe(COSTOS_OT_RESPALDO.HERRERIA)
  })

  it('con costo capturado vale ESE importe, no la suma', () => {
    expect(costoEfectivoDeOt(ot({ costoReal: 12000 }), { HERRERIA: 4000 })).toBe(12000)
  })

  it('CERO es un costo capturado y vale cero', () => {
    expect(costoEfectivoDeOt(ot({ costoReal: 0 }), null)).toBe(0)
  })

  it('`tieneCostoReal` distingue el cero de la ausencia', () => {
    expect(tieneCostoReal(ot({ costoReal: 0 }))).toBe(true)
    expect(tieneCostoReal(ot({ costoReal: null }))).toBe(false)
    expect(tieneCostoReal(ot({}))).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════
//  2 · Los TRES dan la misma cifra — el caso que motivó todo esto
// ════════════════════════════════════════════════════════════════════════════

const CAMPANA: any = { id: 'C1', nombre: 'Campaña Uno', estatus: 'ACTIVA' }

function estado(costoReal: number | null): any {
  return {
    sitios: [{ id: 'S1', nombre: 'Pantalla Uno', predioId: null, caras: 1, tarifaImpresion: 0 }],
    contratos: [],
    arrendadores: [],
    reservas: [],
    campanas: [{ id: 'C1', nombre: 'Campaña Uno', estatus: 'ACTIVA' }],
    clientes: [],
    ordenesImpresion: [],
    ordenesTrabajo: [ot({ costoReal })],
    facturas: [],
    cobranzas: [],
    // `dashboardMetrics` construye además las alertas, que recorren estas
    // rebanadas. Van vacías: lo que se mide aquí es el costo de operación, y un
    // estado a medias revienta con un `TypeError` que no dice nada del costo.
    pagosRenta: [],
    contratosArrendamiento: [],
    incidencias: [],
    propuestas: [],
    creatividades: [],
    licencias: [],
    notificaciones: [],
    configNegocio: { costosOt: { HERRERIA: 4000 } },
  }
}

describe('2 · el dashboard y el P&L por campaña USAN el costo capturado', () => {
  it('el dashboard cobra el costo REAL, no la tarifa del tipo', () => {
    // Con 12 000 capturado y la tarifa en 4 000: si el dashboard siguiera con la
    // tarifa daría 4 000, y el reporte de rentabilidad 12 000. Dos verdades
    // sobre la misma visita.
    expect(dashboardMetrics(estado(12000)).costoOperacionMes).toBe(12000)
  })

  it('y cae a la estimación cuando no hay nada capturado', () => {
    expect(dashboardMetrics(estado(null)).costoOperacionMes).toBe(4000)
  })

  it('el P&L de la campaña cobra el costo REAL', () => {
    expect(margenCampana(CAMPANA, estado(12000)).costoOperacion).toBe(12000)
  })

  it('y cae a la estimación cuando no hay nada capturado', () => {
    expect(margenCampana(CAMPANA, estado(null)).costoOperacion).toBe(4000)
  })

  it('NEGATIVO · un costo capturado de CERO no vuelve a la estimación', () => {
    // El caso que un `||` rompería en los dos sitios a la vez.
    expect(dashboardMetrics(estado(0)).costoOperacionMes).toBe(0)
    expect(margenCampana(CAMPANA, estado(0)).costoOperacion).toBe(0)
  })

  it('los DOS dan la misma cifra que el otro para la misma OT', () => {
    // El invariante que este archivo existe para fijar.
    const e = estado(12000)
    expect(dashboardMetrics(e).costoOperacionMes).toBe(margenCampana(CAMPANA, e).costoOperacion)
  })
})
