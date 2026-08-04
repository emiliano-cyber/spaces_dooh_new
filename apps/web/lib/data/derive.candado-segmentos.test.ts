import { describe, it, expect } from 'vitest'
import { candadoDeSegmentos } from './derive'

// ============================================================================
//  Candado de facturación por SEGMENTO.
//  Lo que estas pruebas protegen: que la evidencia se exija solo del segmento
//  que la campaña realmente tiene. El defecto que motivó el archivo (auditoría
//  QA 04/08/2026, hallazgo C3) fue una copia de la regla en la UI escrita como
//  `oc && fotos && reporte`: eso deja a TODA campaña DOOH con el candado
//  "Pendiente" para siempre, porque una digital no tiene segmento físico y
//  `fotos_comprobatorias` nunca se enciende. El servidor sí la dejaba facturar,
//  así que la UI y el gate se contradecían.
//
//  La regla vive una sola vez, aquí. Si alguien vuelve a reimplementarla en una
//  pantalla, estas pruebas no lo impiden — pero sí fijan cuál es la verdad.
// ============================================================================

const CON_TODO = { ocRecibida: true, evidenciaFisica: true, evidenciaDigital: true }

describe('candadoDeSegmentos', () => {
  it('sin OC no abre, tenga la evidencia que tenga', () => {
    for (const tipo of ['DOOH', 'OOH', 'HIBRIDA']) {
      expect(candadoDeSegmentos(tipo, { ...CON_TODO, ocRecibida: false })).toBe(false)
    }
  })

  describe('DOOH (solo segmento digital)', () => {
    it('abre con OC + reporte, SIN fotos — la regresión de C3', () => {
      expect(
        candadoDeSegmentos('DOOH', { ocRecibida: true, evidenciaFisica: false, evidenciaDigital: true }),
      ).toBe(true)
    })

    it('no abre sin el reporte, aunque haya fotos', () => {
      expect(
        candadoDeSegmentos('DOOH', { ocRecibida: true, evidenciaFisica: true, evidenciaDigital: false }),
      ).toBe(false)
    })
  })

  describe('OOH (solo segmento físico)', () => {
    it('abre con OC + fotos, SIN reporte digital', () => {
      expect(
        candadoDeSegmentos('OOH', { ocRecibida: true, evidenciaFisica: true, evidenciaDigital: false }),
      ).toBe(true)
    })

    it('no abre sin fotos: una campaña física sin evidencia no se factura', () => {
      expect(
        candadoDeSegmentos('OOH', { ocRecibida: true, evidenciaFisica: false, evidenciaDigital: true }),
      ).toBe(false)
    })
  })

  describe('HIBRIDA (ambos segmentos)', () => {
    it('abre solo con las dos evidencias', () => {
      expect(candadoDeSegmentos('HIBRIDA', CON_TODO)).toBe(true)
    })

    it('la evidencia física NO da por cumplida la digital', () => {
      expect(
        candadoDeSegmentos('HIBRIDA', { ocRecibida: true, evidenciaFisica: true, evidenciaDigital: false }),
      ).toBe(false)
    })

    it('ni la digital da por cumplida la física', () => {
      expect(
        candadoDeSegmentos('HIBRIDA', { ocRecibida: true, evidenciaFisica: false, evidenciaDigital: true }),
      ).toBe(false)
    })
  })

  // El caso real que apareció en producción: "prueba anual" (G500), DOOH,
  // oc_recibida=t, fotos_comprobatorias=f, reporte_publicacion=t. El pipeline la
  // marcaba "Lista para facturar", la ficha decía candado "Pendiente" y Finanzas
  // "Nada por facturar". La regla dice que sí se puede facturar.
  it('reproduce la campaña "prueba anual" de producción: facturable', () => {
    expect(
      candadoDeSegmentos('DOOH', { ocRecibida: true, evidenciaFisica: false, evidenciaDigital: true }),
    ).toBe(true)
  })
})
