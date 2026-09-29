import { describe, it, expect } from 'vitest'
import {
  componerDescuentos,
  descuentoContraTope,
  descuentoDentroDelTope,
  DescuentoSobreTope,
  CODIGO_CUENTA_CONTRA_TOPE,
} from './descuento'

// ============================================================================
//  COD-02 · ¿el CÓDIGO PROMOCIONAL cuenta contra el tope de la organización?
//  ADR 0039, Fase 3.
// ----------------------------------------------------------------------------
//  ⚠️ ES UNA PREGUNTA DE NEGOCIO Y ESTÁ ABIERTA CON EL DUEÑO. La respuesta
//  implementada es **NO cuenta**, y vive entera en una constante. Estas pruebas
//  fijan las DOS cosas por separado:
//
//   · que la ARITMÉTICA de componer tres capas es correcta —eso vale para
//     cualquiera de las dos respuestas, y es lo que se prueba en el bloque 1—;
//   · y que la respuesta de HOY es la que dice la constante, en el bloque 2.
//
//  Así, cambiar la respuesta es cambiar la constante y un puñado de
//  expectativas, y NO volver a escribir la aritmética.
// ============================================================================

describe('1 · componerDescuentos — se COMPONE, no se suma (ADR 0039 §1)', () => {
  it('20 % y 20 % dejan al cliente pagando el 64 %: se regaló el 36, no el 40', () => {
    expect(componerDescuentos(20, 20)).toBeCloseTo(36, 9)
  })

  it('TRES capas del 20 % dejan 0,8 × 0,8 × 0,8: se regaló el 48,8 %, no el 60', () => {
    // Es el ejemplo exacto del encargo de la Fase 3.
    expect(componerDescuentos(20, 20, 20)).toBeCloseTo(48.8, 9)
  })

  it('sin ninguna capa no se regala nada', () => {
    expect(componerDescuentos()).toBe(0)
    expect(componerDescuentos(0, 0, 0)).toBe(0)
  })

  it('una sola capa se devuelve tal cual', () => {
    expect(componerDescuentos(15)).toBeCloseTo(15, 9)
  })

  it('el 100 % en cualquier capa deja el total en 100 y no lo pasa', () => {
    expect(componerDescuentos(100, 50, 20)).toBe(100)
  })

  it('lo ILEGIBLE cuenta como CERO y jamás envenena el resultado', () => {
    // `NaN > tope` es false, o sea que un NaN aquí DESACTIVARÍA el tope en
    // silencio. Es el fallo que documenta la cabecera de `lib/descuento.ts` y
    // el mutante M10 de la Fase 2.
    expect(componerDescuentos(NaN, 20)).toBeCloseTo(20, 9)
    expect(componerDescuentos(20, undefined)).toBeCloseTo(20, 9)
    expect(componerDescuentos(20, null)).toBeCloseTo(20, 9)
    expect(componerDescuentos(20, 'abc')).toBeCloseTo(20, 9)
    expect(componerDescuentos(20, {})).toBeCloseTo(20, 9)
    expect(componerDescuentos(20, Infinity)).toBeCloseTo(20, 9)
    // Un negativo no puede SUBIR el precio por la puerta de atrás.
    expect(componerDescuentos(20, -50)).toBeCloseTo(20, 9)
  })

  it('un porcentaje por encima de 100 se acota, no se desborda', () => {
    expect(componerDescuentos(250)).toBe(100)
  })
})

describe('2 · la respuesta de HOY: el cupón NO cuenta contra el tope', () => {
  it('la constante dice que no cuenta', () => {
    expect(CODIGO_CUENTA_CONTRA_TOPE).toBe(false)
  })

  it('un cupón del 50 % no mueve el número que se compara contra el tope', () => {
    // Con volumen 10 % y comercial 20 %, el efectivo es 28 % lleve o no cupón.
    expect(descuentoContraTope(20, 10, 0)).toBeCloseTo(28, 9)
    expect(descuentoContraTope(20, 10, 50)).toBeCloseTo(28, 9)
  })

  it('un cupón NO puede hacer que se rechace un descuento que sí cabía', () => {
    // Tope 20 %. Comercial 20 % y cupón 50 %: pasa, porque el cupón no cuenta.
    expect(descuentoDentroDelTope(20, 20, 0, 50)).toBe(20)
  })

  it('y el VOLUMEN sí sigue contando: la Fase 2 no se toca', () => {
    // VOL-02 sigue vigente. Con 15 % de volumen y tope 20 %, al comercial le
    // quedan ~5,9 puntos — y un cupón no le regala ni uno más.
    expect(() => descuentoDentroDelTope(10, 20, 15, 50)).toThrow(DescuentoSobreTope)
    expect(descuentoDentroDelTope(5, 20, 15, 50)).toBe(5)
  })

  it('los llamantes anteriores a la Fase 3 se comportan EXACTAMENTE igual', () => {
    // Éste es el invariante que hace que esta fase no mueva una sola venta de
    // la base instalada: omitir el cupón es idéntico a no tenerlo.
    expect(descuentoContraTope(20, 10)).toBe(descuentoContraTope(20, 10, 0))
    expect(descuentoDentroDelTope(20, 100)).toBe(20)
    expect(descuentoDentroDelTope(20, 100, 0)).toBe(20)
  })
})

describe('3 · si mañana el dueño dice que SÍ cuenta, la aritmética ya está', () => {
  it('componer las tres capas da el número que habría que comparar', () => {
    // Esto NO es el comportamiento de hoy: es la cuenta que `descuentoContraTope`
    // haría el día que la constante pase a `true`. Se fija aquí para que el
    // cambio sea una línea y no una reescritura — y para que quede escrito lo
    // que costaría: con volumen 15 % y cupón 20 %, el efectivo ya es 32 % y NO
    // cabría bajo un tope del 20 % ni con cero descuento comercial. O sea que
    // el cupón del dueño quedaría bloqueado por el tope del dueño.
    expect(componerDescuentos(15, 0, 20)).toBeCloseTo(32, 9)
    expect(componerDescuentos(15, 20, 20)).toBeCloseTo(45.6, 9)
  })
})
