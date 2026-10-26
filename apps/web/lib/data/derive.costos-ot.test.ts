import { describe, it, expect } from 'vitest'
import { dashboardMetrics, margenCampana } from './derive'
import { rentabilidadPorTrimestre } from './reportes'
import { COSTOS_OT_RESPALDO } from '../costos-ot'

// ============================================================================
//  El motor de costos deja de usar la constante `COSTO_OPERATIVO_POR_OT` y lee
//  `configNegocio.costosOt`, con respaldo por tipo.
// ----------------------------------------------------------------------------
//  Se prueba desde `dashboardMetrics` y `margenCampana` —los dos sitios que
//  usaban la constante (derive.ts:618 y :735)— porque el riesgo no es la
//  función nueva: es que uno de los dos se quede leyendo la constante y el
//  margen del dashboard y el de la campaña dejen de cuadrar entre sí sin que
//  nada falle. Eso ya pasó en este repo con la ocupación (A-2) y con la
//  atribución de renta.
// ============================================================================

function baseState(over: Record<string, unknown>): any {
  const vacio = {
    sitios: [], reservas: [], contratos: [], arrendadores: [], campanas: [],
    clientes: [], propuestas: [], ordenesCompra: [], ordenesImpresion: [],
    ordenesTrabajo: [], cobranzas: [], facturas: [], incidencias: [],
    pagosRenta: [], creatividades: [], evidencias: [], notificaciones: [],
    acciones: [], predios: [], razonesSociales: [], licencias: [],
  }
  return { ...vacio, ...over }
}

const OTS = [
  { id: 'OT1', campanaId: 'C1', sitioId: 'S1', tipo: 'HERRERIA', estatus: 'COMPLETADA' },
  { id: 'OT2', campanaId: 'C1', sitioId: 'S1', tipo: 'INSPECCION', estatus: 'PENDIENTE' },
  // CANCELADA: no cuenta, ni antes ni ahora.
  { id: 'OT3', campanaId: 'C1', sitioId: 'S1', tipo: 'HERRERIA', estatus: 'CANCELADA' },
]

// DASH-PERIODO (26/10) · el costo de operación del dashboard ya no sale de
// `dashboardMetrics`: lo da el motor de Reportes para el mes en curso. Se
// prueba ahí, con la misma tabla de costos, y con fecha en cada OT porque el
// motor la cobra en el mes en que se trabaja.
const OTS_DEL_MES = OTS.map((o) => ({ ...o, fechaProgramada: '2026-10-10' }))
const costoOperacionDelMes = (costosOt?: Record<string, number> | null) =>
  rentabilidadPorTrimestre(
    { sitios: [{ id: 'S1', nombre: 'S1' } as any], contratos: [], arrendadores: [], reservas: [], ordenesTrabajo: OTS_DEL_MES, costosOt },
    { desde: '2026-10-01', hasta: '2026-10-31', granularidad: 'mes' },
  ).totales.costoOperacion

describe('el costo de operacion del mes (motor de Reportes) por tipo de OT', () => {
  it('sin configuracion suma el respaldo de cada tipo', () => {
    expect(costoOperacionDelMes(null)).toBe(COSTOS_OT_RESPALDO.HERRERIA + COSTOS_OT_RESPALDO.INSPECCION)
  })

  it('el tipo configurado manda y el no configurado cae al respaldo', () => {
    expect(costoOperacionDelMes({ HERRERIA: 4000 })).toBe(4000 + COSTOS_OT_RESPALDO.INSPECCION)
  })

  it('un tenant sin fila de configuracion no revienta: cae al respaldo entero', () => {
    expect(costoOperacionDelMes(undefined)).toBe(COSTOS_OT_RESPALDO.HERRERIA + COSTOS_OT_RESPALDO.INSPECCION)
  })

  it('dashboardMetrics sin configuracion tampoco revienta', () => {
    const sinConfig = baseState({ ordenesTrabajo: OTS })
    delete sinConfig.configNegocio
    expect(() => dashboardMetrics(sinConfig)).not.toThrow()
  })
})

describe('margenCampana — la MISMA tabla de costos que el dashboard', () => {
  it('lee la configuracion del tenant, no la constante', () => {
    const estado = baseState({
      ordenesTrabajo: OTS,
      campanas: [{ id: 'C1', nombre: 'Campana 1' }],
      configNegocio: { costosOt: { HERRERIA: 4000, INSPECCION: 0 } },
    })
    const m = margenCampana({ id: 'C1' } as any, estado)
    expect(m.costoOperacion).toBe(4000)
  })
})
