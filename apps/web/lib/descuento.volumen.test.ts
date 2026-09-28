import { describe, it, expect } from 'vitest'
import {
  descuentoContraTope,
  descuentoDentroDelTope,
  DescuentoSobreTope,
} from './descuento'

// ============================================================================
//  VOL-02 · ¿el descuento por volumen cuenta contra el TOPE de la organización?
// ----------------------------------------------------------------------------
//  LA DECISIÓN ES DEL DUEÑO Y ESTÁ PREGUNTADA. Lo que estas pruebas fijan es la
//  opción implementada —SÍ cuenta, medida en COMPUESTO— y, sobre todo, que vive
//  en UNA función: `descuentoContraTope`. Cambiar la respuesta es cambiar el
//  cuerpo de esa función y estos casos; ningún otro archivo se entera.
//
//  Por qué SÍ cuenta, mientras el dueño no diga lo contrario: el tope nació el
//  2026-09-28 porque cualquier comercial podía regalar el 90 %. Si el volumen
//  no contara, un 15 % de volumen más el tope entero volvería a dejar el techo
//  por encima de lo que alguien autorizó, y el tope dejaría de ser el techo.
//  «La regla nace cerrada y se abre a propósito» (ADR 0039 §2).
//
//  Por qué COMPUESTO y no sumado: porque compuesto es lo que de verdad se
//  regaló. 20 y 20 dejan al cliente pagando el 64 %, o sea un 36 % regalado —no
//  un 40 %—, y comparar contra el tope un número que nadie cobró sería cerrar
//  ventas por un margen que no se perdió.
// ============================================================================

describe('descuentoContraTope — el número que se compara con el techo', () => {
  it('sin volumen es el descuento comercial tal cual: nada cambia para la base instalada', () => {
    expect(descuentoContraTope(40, 0)).toBe(40)
    expect(descuentoContraTope(0, 0)).toBe(0)
    expect(descuentoContraTope(100, 0)).toBe(100)
  })

  it('COMPONE, no suma: 20 y 20 son 36, no 40', () => {
    expect(descuentoContraTope(20, 20)).toBeCloseTo(36, 10)
  })

  it('con volumen y sin descuento comercial, el que cuenta es el volumen', () => {
    expect(descuentoContraTope(0, 15)).toBeCloseTo(15, 10)
  })

  it('nunca pasa de 100 ni baja de 0', () => {
    expect(descuentoContraTope(100, 100)).toBeCloseTo(100, 10)
    expect(descuentoContraTope(100, 50)).toBeCloseTo(100, 10)
  })
})

describe('descuentoDentroDelTope con volumen', () => {
  it('sin volumen se comporta EXACTAMENTE como antes (dos argumentos)', () => {
    expect(descuentoDentroDelTope(40, 40)).toBe(40)
    expect(() => descuentoDentroDelTope(41, 40)).toThrow(DescuentoSobreTope)
  })

  it('el volumen se come margen de negociacion: con 15 % de volumen y tope 20, el 10 % comercial ya no cabe', () => {
    // compuesto(10, 15) = 1 − 0.9 × 0.85 = 23.5 % > 20
    expect(() => descuentoDentroDelTope(10, 20, 15)).toThrow(DescuentoSobreTope)
    // y el que sí cabe: compuesto(5, 15) = 1 − 0.95 × 0.85 = 19.25 % ≤ 20
    expect(descuentoDentroDelTope(5, 20, 15)).toBe(5)
  })

  it('el mensaje DICE que el volumen entró en la cuenta, o nadie entiende por qué le rechazan un 10 %', () => {
    try {
      descuentoDentroDelTope(10, 20, 15)
      throw new Error('deberia haber reventado')
    } catch (e) {
      expect(e).toBeInstanceOf(DescuentoSobreTope)
      const msg = (e as Error).message
      expect(msg).toMatch(/volumen/i)
      expect(msg).toMatch(/15/)
      expect(msg).toMatch(/20/)
      expect(msg).toMatch(/23\.5/)
    }
  })

  it('el limite es INCLUSIVO tambien con volumen', () => {
    // compuesto(0, 20) = 20 exacto
    expect(descuentoDentroDelTope(0, 20, 20)).toBe(0)
  })

  it('el volumen SOLO, ya por encima del tope, no deja poner ni un 0 % comercial', () => {
    // Es una consecuencia real de la decisión, y tiene que estar escrita: si el
    // dueño baja el tope por debajo de su propia escala de volumen, ninguna
    // propuesta con volumen se puede tocar hasta que arregle una de las dos.
    expect(() => descuentoDentroDelTope(0, 10, 15)).toThrow(DescuentoSobreTope)
  })

  it('un volumen ilegible se lee como CERO volumen, nunca como NaN', () => {
    // `NaN > tope` es false: sin esta guarda, un volumen corrupto desactivaría
    // el tope en silencio, que es el modo de fallo del que nació este archivo.
    expect(descuentoDentroDelTope(40, 40, NaN as never)).toBe(40)
    expect(descuentoDentroDelTope(40, 40, 'basura' as never)).toBe(40)
    expect(() => descuentoDentroDelTope(41, 40, undefined as never)).toThrow(DescuentoSobreTope)
  })

  it('y el ilegible SIGUE RECHAZANDO lo que no cabe — es el caso que de verdad importa', () => {
    // ⚠️ Esta prueba nació de un MUTANTE QUE SOBREVIVIÓ: quitar el recorte de
    // `descuentoContraTope` dejaba pasar TODOS los casos de arriba, porque
    // `undefined` cae en el valor por omisión y los otros dos no piden rechazo.
    // Con el volumen en NaN, el efectivo es NaN, `NaN - techo > 0` es false y
    // el tope deja de existir sin dar el menor error. Aquí se pide el rechazo.
    expect(() => descuentoDentroDelTope(41, 40, NaN as never)).toThrow(DescuentoSobreTope)
    expect(() => descuentoDentroDelTope(41, 40, 'basura' as never)).toThrow(DescuentoSobreTope)
    expect(() => descuentoDentroDelTope(41, 40, {} as never)).toThrow(DescuentoSobreTope)
  })

  it('un volumen fuera de [0, 100] se recorta: un negativo NO puede regalar margen', () => {
    // Del mismo mutante. Sin recorte, un `-50` daría un efectivo MENOR que el
    // comercial pedido, o sea que una fila corrupta AMPLIARÍA el techo.
    expect(descuentoContraTope(40, -50)).toBe(40)
    expect(() => descuentoDentroDelTope(41, 40, -50 as never)).toThrow(DescuentoSobreTope)
    expect(descuentoContraTope(0, 150)).toBeCloseTo(100, 10)
  })
})
