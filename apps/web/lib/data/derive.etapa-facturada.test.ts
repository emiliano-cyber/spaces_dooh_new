import { describe, it, expect } from 'vitest'
import { pipelineStage, etapasPipeline, ETAPA_LABEL } from './derive'
import type { DemoState, Campana } from './types'

// ============================================================================
//  INC-09.5 · la etapa «Facturada».
//
//  El pipeline terminaba en «Lista para facturar», así que una campaña YA
//  FACTURADA se quedaba ahí — en ámbar, como si faltara algo por hacer. No era
//  un color mal elegido: la derivación no tenía forma de expresar «ya está
//  facturada», porque esa etapa no existía.
//
//  Lo que hay que probar es el ORDEN de las comprobaciones. Si «facturada» se
//  mirara DESPUÉS del candado, nunca se alcanzaría: el candado está completo en
//  toda campaña que llegó a facturarse, así que ganaría siempre y el defecto
//  seguiría exactamente igual.
// ============================================================================

const campana = (over: Partial<Campana> = {}): Campana =>
  ({
    id: 'c1',
    tipoCampana: 'DOOH',
    estadoComercial: 'ACTIVA',
    ocRecibida: true,
    reportePublicacion: true,
    fotosComprobatorias: false,
    ...over,
  }) as unknown as Campana

const estado = (over: Partial<DemoState> = {}): DemoState =>
  ({
    facturas: [],
    ordenesTrabajo: [],
    evidencias: [],
    reservas: [],
    ...over,
  }) as unknown as DemoState

describe('pipelineStage — etapa «Facturada» (INC-09.5)', () => {
  it('con factura emitida, la etapa es «facturada»', () => {
    const c = campana()
    const s = estado({ facturas: [{ id: 'f1', campanaId: 'c1' }] as any })
    expect(pipelineStage(c, s)).toBe('facturada')
  })

  it('sin factura y con el candado completo, sigue en «lista_facturar»', () => {
    // El comportamiento de antes se conserva: esto NO es una regresión del
    // candado, solo se le añade un paso después.
    const c = campana()
    expect(pipelineStage(c, estado())).toBe('lista_facturar')
  })

  it('la factura de OTRA campaña no la da por facturada', () => {
    // Con un `facturas.length > 0` en vez de filtrar por campaña, toda campaña
    // del tenant se pintaría como facturada en cuanto existiera una factura.
    const c = campana()
    const s = estado({ facturas: [{ id: 'f1', campanaId: 'OTRA' }] as any })
    expect(pipelineStage(c, s)).toBe('lista_facturar')
  })

  it('«facturada» es la ÚLTIMA etapa, y aplica a los tres tipos de campaña', () => {
    // El invariante que la propia función documenta: solo puede devolver una
    // etapa contenida en `etapasPipeline(c)`. Si «facturada» faltara en alguna
    // lista, el Stepper pintaría TODOS los pasos como pendientes.
    for (const tipo of ['DOOH', 'OOH', 'HIBRIDA'] as const) {
      const etapas = etapasPipeline(campana({ tipoCampana: tipo }))
      expect(etapas).toContain('facturada')
      expect(etapas[etapas.length - 1]).toBe('facturada')
    }
  })

  it('la etapa cumple el invariante: la devuelta está en las aplicables', () => {
    const c = campana()
    const s = estado({ facturas: [{ id: 'f1', campanaId: 'c1' }] as any })
    expect(etapasPipeline(c)).toContain(pipelineStage(c, s))
  })

  it('tiene etiqueta legible', () => {
    expect(ETAPA_LABEL.facturada).toBe('Facturada')
  })
})
