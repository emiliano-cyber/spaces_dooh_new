import { describe, it, expect } from 'vitest'
import { plural, conteo } from './plural'

// ============================================================================
//  INC-09.4 · concordancia de número.
//
//  El defecto era «1 resultados». Lo que hay que probar no es que 2 lleve «s»
//  —eso lo acierta cualquier implementación— sino los bordes: el 1, el 0 y la
//  forma irregular, que es donde M10 se equivocó con «mess».
// ============================================================================

describe('plural', () => {
  it('1 va en singular — el defecto que esto viene a arreglar', () => {
    expect(plural(1, 'resultado')).toBe('resultado')
  })

  it('0 va en plural, que es como se dice en voz alta', () => {
    expect(plural(0, 'resultado')).toBe('resultados')
  })

  it('más de uno va en plural', () => {
    expect(plural(2, 'resultado')).toBe('resultados')
    expect(plural(37, 'pantalla')).toBe('pantallas')
  })

  it('acepta una forma plural explícita, para los que no acaban en vocal', () => {
    // La lección de M10: «mes» + «s» = «mess». Aquí no puede pasar porque la
    // forma se pasa a mano cuando hace falta.
    expect(plural(2, 'mes', 'meses')).toBe('meses')
    expect(plural(1, 'mes', 'meses')).toBe('mes')
  })

  it('los negativos van en plural sin romperse', () => {
    expect(plural(-1, 'resultado')).toBe('resultado')
    expect(plural(-3, 'resultado')).toBe('resultados')
  })
})

describe('conteo', () => {
  it('junta número y sustantivo concordados', () => {
    expect(conteo(1, 'resultado')).toBe('1 resultado')
    expect(conteo(0, 'resultado')).toBe('0 resultados')
    expect(conteo(12, 'pantalla')).toBe('12 pantallas')
  })

  it('respeta la forma plural explícita', () => {
    expect(conteo(3, 'mes', 'meses')).toBe('3 meses')
  })
})
