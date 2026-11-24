import { describe, it, expect } from 'vitest'
import { problemaDeOrden } from './orden-fila'

// ============================================================================
//  Guardar el orden de una fila del plano (dueño, 24/11: «tocar y flechas»).
//  El servidor solo acepta la fila ENTERA (todas sus vallas activas, de un
//  sitio y una cara) y con cada grupo junto: si no, el plano quedaría con
//  vallas sin posición o con un grupo partido, que el dibujo no sabe pintar.
// ============================================================================

const v = (id: string, sitioId = 'S', cara: number | null = 1, grupoId: string | null = null) => ({ id, sitioId, cara, grupoId, activo: true })

describe('problemaDeOrden', () => {
  const fila = [v('a'), v('b', 'S', 1, 'g'), v('c', 'S', 1, 'g'), v('d')]

  it('la fila entera, con el grupo junto: sin problema', () => {
    expect(problemaDeOrden(fila, ['d', 'b', 'c', 'a'])).toBeNull()
  })

  it('falta una valla de la fila', () => {
    expect(problemaDeOrden(fila, ['a', 'b', 'c'])).toBe('incompleta')
  })

  it('una valla repetida', () => {
    expect(problemaDeOrden(fila, ['a', 'b', 'c', 'c'])).toBe('incompleta')
  })

  it('una valla que no es de esa fila (otra cara u otro sitio, o ajena)', () => {
    const otras = [...fila, v('x', 'S', 2), v('y', 'T', 1)]
    expect(problemaDeOrden(otras, ['a', 'b', 'c', 'x'])).toBe('mezcla')
    expect(problemaDeOrden(otras, ['a', 'b', 'c', 'y'])).toBe('mezcla')
    expect(problemaDeOrden(fila, ['a', 'b', 'c', 'zz'])).toBe('ajena')
  })

  it('el grupo partido', () => {
    expect(problemaDeOrden(fila, ['b', 'a', 'c', 'd'])).toBe('grupo-partido')
  })

  it('las vallas de baja no cuentan como parte de la fila', () => {
    const conBaja = [...fila, { ...v('z'), activo: false }]
    expect(problemaDeOrden(conBaja, ['a', 'b', 'c', 'd'])).toBeNull()
  })

  it('vacío', () => {
    expect(problemaDeOrden(fila, [])).toBe('incompleta')
  })
})
