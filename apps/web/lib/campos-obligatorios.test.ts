import { describe, it, expect } from 'vitest'
import { estaVacio, camposFaltantes } from './campos-obligatorios'

// ============================================================================
//  OBLIG-01 · qué cuenta como «falta este dato».
//
//  Pedido del dueño el 20/10: en todo formulario de alta o edición, los campos
//  obligatorios llevan asterisco y, si falta alguno al guardar, se pinta en
//  rojo ESE campo. La decisión de qué está vacío vive aquí, en una función
//  pura, y no repetida en cada `.tsx`: dentro de un `.tsx` no la prueba nadie
//  (`vitest.config.ts` no monta jsdom).
// ============================================================================

describe('estaVacio', () => {
  it('vacío: null, undefined, cadena vacía o solo espacios', () => {
    for (const v of [null, undefined, '', '   ', '\n\t']) expect(estaVacio(v), JSON.stringify(v)).toBe(true)
  })

  it('vacío: una cifra que no se entiende (NaN) y una lista sin elementos', () => {
    expect(estaVacio(Number.NaN)).toBe(true)
    expect(estaVacio('NaN')).toBe(true)
    expect(estaVacio([])).toBe(true)
  })

  it('NO vacío: el cero es un dato (una comisión de 0 % es válida)', () => {
    expect(estaVacio(0)).toBe(false)
    expect(estaVacio('0')).toBe(false)
  })

  it('NO vacío: false es una respuesta, no una ausencia', () => {
    expect(estaVacio(false)).toBe(false)
  })

  it('NO vacío: texto, números, listas con algo y objetos', () => {
    for (const v of ['a', ' a ', 12, ['x'], { id: 1 }]) expect(estaVacio(v), JSON.stringify(v)).toBe(false)
  })
})

describe('camposFaltantes', () => {
  it('devuelve SOLO los obligatorios vacíos, en el orden en que se declararon', () => {
    const valores = { nombre: '', email: 'a@b.c', telefono: '', notas: '' }
    expect(camposFaltantes(valores, ['telefono', 'nombre', 'email'])).toEqual(['telefono', 'nombre'])
  })

  it('un opcional vacío no falta nunca', () => {
    expect(camposFaltantes({ nombre: 'Ana', notas: '' }, ['nombre'])).toEqual([])
  })

  it('un obligatorio condicional solo cuenta si su condición se cumple', () => {
    const valores = { tipo: 'AGENCIA', comision: '' }
    expect(camposFaltantes(valores, ['tipo', { campo: 'comision', si: valores.tipo === 'AGENCIA' }])).toEqual(['comision'])
    expect(camposFaltantes({ ...valores, tipo: 'DIRECTO' }, ['tipo', { campo: 'comision', si: false }])).toEqual([])
  })
})
