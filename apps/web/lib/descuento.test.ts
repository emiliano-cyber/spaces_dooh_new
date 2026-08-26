import { describe, it, expect } from 'vitest'
import { descuentoValido } from './descuento'

// ============================================================================
//  VAL — un descuento que no es un número envenenaba la propuesta entera.
// ----------------------------------------------------------------------------
//  Encontrado en el barrido de validación del 2026-08-26. `PATCH
//  /api/propuestas/[id]` pasa `body.descuentoPct` CRUDO: ese camino no tiene
//  esquema, y el recorte vivía en el repositorio:
//
//      Math.max(0, Math.min(100, Number(input.descuentoPct)))
//
//  Con `'abc'`, `Number()` da `NaN`, y **el recorte no lo atrapa**:
//  `Math.min(100, NaN)` es `NaN` y `Math.max(0, NaN)` también. Parece una
//  guarda y no lo es.
//
//  ─── Y por qué no lo frenaba la base ──────────────────────────────────────
//  Porque `numeric` de Postgres **admite NaN**. No es un error de tipo: se
//  guarda, y `'NaN'::numeric * 5` vuelve a ser `NaN`. Así que el descuento
//  contamina el bruto, el neto y el aprobado de esa propuesta — y la petición
//  contestaba **200 OK**.
//
//  Se valida en el repositorio y no en la ruta porque el recorte ya estaba
//  aquí: es el único punto por el que pasa el valor, y dejar la guarda lejos
//  del recorte es como se llegó a tener un recorte que no recorta.
// ============================================================================

describe('descuentoValido', () => {
  it('acepta los extremos y los recorta al rango', () => {
    expect(descuentoValido(0)).toBe(0)
    expect(descuentoValido(100)).toBe(100)
    expect(descuentoValido(-5)).toBe(0)
    expect(descuentoValido(250)).toBe(100)
  })

  it('acepta una cadena numérica, que es como llega por HTTP', () => {
    // El cuerpo viaja en JSON pero los formularios mandan texto: si esto
    // dejara de aceptarse, un descuento legítimo empezaría a fallar.
    expect(descuentoValido('12')).toBe(12)
    expect(descuentoValido('12.5')).toBe(12.5)
  })

  it('RECHAZA lo que no es un número, en vez de guardar NaN', () => {
    for (const basura of ['abc', '', '  ', {}, [], true, 'NaN', 'Infinity']) {
      expect(() => descuentoValido(basura as never), `deberia rechazar ${JSON.stringify(basura)}`).toThrow()
    }
  })

  it('RECHAZA Infinity, que tampoco es un descuento', () => {
    // `Math.min(100, Infinity)` sí da 100, así que el recorte lo dejaba pasar
    // «bien». Se rechaza igualmente: quien manda `Infinity` no está pidiendo
    // el 100 %, está mandando basura, y aceptarla esconde el error de quien
    // llama.
    expect(() => descuentoValido(Infinity)).toThrow()
    expect(() => descuentoValido(-Infinity)).toThrow()
  })
})
