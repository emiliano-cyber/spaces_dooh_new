import { describe, it, expect } from 'vitest'
import { pipelineStage, etapasPipeline, etapaIndex } from './derive'

// ============================================================================
//  Invariante del pipeline: `pipelineStage` SOLO puede devolver una etapa que
//  pertenezca a `etapasPipeline(campaña)`. Si devuelve una ajena, `etapaIndex`
//  da -1, el Stepper pinta todos los pasos como pendientes y el pipeline del
//  detalle de campaña se ve vacío aunque la campaña esté avanzada.
//
//  Caso real que lo disparaba: campaña DOOH ("Coca-Cola — Verano") con una OT
//  de MONTAJE_DIGITAL COMPLETADA. `pipelineStage` devolvía 'instalada', que es
//  etapa FÍSICA y por tanto está excluida del pipeline de una DOOH.
// ============================================================================

function baseState(over: Record<string, unknown>): any {
  const vacio = {
    sitios: [], reservas: [], contratos: [], arrendadores: [], campanas: [],
    clientes: [], propuestas: [], ordenesCompra: [], ordenesImpresion: [],
    ordenesTrabajo: [], cobranzas: [], facturas: [], incidencias: [],
    pagosRenta: [], creatividades: [], evidencias: [], notificaciones: [],
    acciones: [], reservasTentativas: [],
  }
  return { ...vacio, ...over }
}

function campana(over: Record<string, unknown> = {}): any {
  return {
    id: 'C1',
    tipoCampana: 'DOOH',
    estadoComercial: 'ACTIVA',
    ocRecibida: false,
    fotosComprobatorias: false,
    reportePublicacion: false,
    enviadaDominio: false,
    validacionEstatus: null,
    fechaInicio: '2026-01-01',
    ...over,
  }
}

describe('pipelineStage respeta las etapas del tipo de campaña', () => {
  it('una DOOH con montaje digital COMPLETADO no cae en la etapa física "instalada"', () => {
    const c = campana({ tipoCampana: 'DOOH' })
    const state = baseState({
      campanas: [c],
      ordenesTrabajo: [{ id: 'OT1', campanaId: 'C1', tipo: 'MONTAJE_DIGITAL', estatus: 'COMPLETADA' }],
    })

    const etapa = pipelineStage(c, state)
    const etapas = etapasPipeline(c)

    expect(etapas).not.toContain('instalada')
    // Sin la corrección esto devolvía 'instalada' y el índice era -1.
    expect(etapas).toContain(etapa)
    expect(etapaIndex(etapa, etapas)).toBeGreaterThanOrEqual(0)
  })

  it('una DOOH con evidencia de montaje digital tampoco', () => {
    const c = campana({ tipoCampana: 'DOOH' })
    const state = baseState({
      campanas: [c],
      ordenesTrabajo: [{ id: 'OT1', campanaId: 'C1', tipo: 'MONTAJE_DIGITAL', estatus: 'EN_PROCESO' }],
      evidencias: [{ id: 'E1', otId: 'OT1', timestamp: '2026-02-01' }],
    })

    const etapa = pipelineStage(c, state)
    expect(etapasPipeline(c)).toContain(etapa)
  })

  it('una OOH con montaje de lona COMPLETADO sí llega a "instalada"', () => {
    const c = campana({ tipoCampana: 'OOH' })
    const state = baseState({
      campanas: [c],
      ordenesTrabajo: [{ id: 'OT1', campanaId: 'C1', tipo: 'MONTAJE_LONA', estatus: 'COMPLETADA' }],
    })

    expect(pipelineStage(c, state)).toBe('instalada')
  })

  it('una DOOH con orden de impresión no cae en la etapa física "en_produccion"', () => {
    const c = campana({ tipoCampana: 'DOOH' })
    const state = baseState({
      campanas: [c],
      ordenesImpresion: [{ id: 'OI1', campanaId: 'C1', estatus: 'IMPRESO', creadoEn: '2026-01-05' }],
    })

    const etapa = pipelineStage(c, state)
    expect(etapasPipeline(c)).toContain(etapa)
  })

  it('la etapa derivada pertenece al pipeline en los 3 tipos de campaña', () => {
    for (const tipo of ['DOOH', 'OOH', 'HIBRIDA']) {
      const c = campana({ tipoCampana: tipo })
      const state = baseState({
        campanas: [c],
        ordenesTrabajo: [{ id: 'OT1', campanaId: 'C1', tipo: 'MONTAJE_DIGITAL', estatus: 'COMPLETADA' }],
        ordenesImpresion: [{ id: 'OI1', campanaId: 'C1', estatus: 'IMPRESO', creadoEn: '2026-01-05' }],
        creatividades: [{ id: 'CR1', campanaId: 'C1', estatusValidacion: 'VALIDADA', creadoEn: '2026-01-02' }],
      })
      const etapas = etapasPipeline(c)
      expect(etapas, `tipo ${tipo}`).toContain(pipelineStage(c, state))
    }
  })
})

describe('etapaIndex nunca devuelve -1', () => {
  it('degrada al primer paso si la etapa no pertenece a la lista', () => {
    expect(etapaIndex('instalada', ['reservada', 'confirmada'] as any)).toBe(0)
  })
})
