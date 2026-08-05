import { describe, it, expect } from 'vitest'
import { tiposOtPara, tipoOtAplica, TIPO_OT_LABEL, TODOS_TIPOS_OT } from './tipos-ot'

// ============================================================================
//  M15 · Los tipos de tarea de cuadrilla.
//
//  El hallazgo era que el catálogo de Configuración salía vacío mientras
//  Operaciones tenía una OT de «Montaje de lona». La causa: ese catálogo era un
//  editor de texto libre que no leía nadie, y los tipos reales viven en un enum
//  con reglas por tipo de pantalla. Lo que se ancla aquí es la regla real, que
//  ahora comparten la UI (para ofrecer) y el servidor (para rechazar).
// ============================================================================

describe('tiposOtPara — lo que se puede ofrecer', () => {
  it('una DIGITAL no lleva lona ni herrería', () => {
    const digital = tiposOtPara(true)
    expect(digital).not.toContain('MONTAJE_LONA')
    expect(digital).not.toContain('HERRERIA')
    expect(digital).toContain('MANTENIMIENTO_PREVENTIVO')
    expect(digital).toContain('INSPECCION')
  })

  it('una FIJA sí las lleva', () => {
    const fija = tiposOtPara(false)
    expect(fija).toContain('MONTAJE_LONA')
    expect(fija).toContain('HERRERIA')
  })

  it('sin pantalla elegida se ofrecen todos los vigentes', () => {
    expect(tiposOtPara(null).length).toBeGreaterThan(tiposOtPara(true).length)
  })

  it('MONTAJE_DIGITAL no se ofrece nunca: está obsoleto', () => {
    // El servidor lo rechaza con 409 desde que el arte digital se sube por
    // «Subir a producción». La UI lo seguía ofreciendo, así que se podía elegir
    // una tarea que la API iba a rechazar.
    for (const lista of [tiposOtPara(null), tiposOtPara(true), tiposOtPara(false)]) {
      expect(lista).not.toContain('MONTAJE_DIGITAL')
    }
  })

  it('pero conserva su etiqueta, porque hay OT históricas con ese tipo', () => {
    expect(TIPO_OT_LABEL.MONTAJE_DIGITAL).toBe('Montaje digital')
    expect(TODOS_TIPOS_OT).toContain('MONTAJE_DIGITAL')
  })
})

describe('tipoOtAplica — lo que el servidor acepta', () => {
  it('coincide exactamente con lo que la UI ofrece', () => {
    // La divergencia entre estas dos listas es el modo de fallo que la
    // unificación viene a eliminar: la UI ofrecía algo y la API lo rechazaba.
    for (const digital of [true, false]) {
      const ofrecidos = tiposOtPara(digital)
      for (const t of TODOS_TIPOS_OT) {
        expect(tipoOtAplica(t, digital), `${t} · digital=${digital}`).toBe(ofrecidos.includes(t))
      }
    }
  })

  it('rechaza un tipo que no existe', () => {
    expect(tipoOtAplica('PINTAR_DE_AZUL', false)).toBe(false)
  })
})
