import { describe, it, expect } from 'vitest'
import { marcaCoincideConCliente, marcaNoCoincideConCliente, cambioDeMarca } from './propuesta-marca'

// ============================================================================
//  PROP-MARCA (decisión del dueño, 20/11) · «aviso cuando la marca no coincide
//  con el cliente». Solo informa: la marca escrita puede ser legítimamente
//  otra (una agencia que compra para Pepsi), pero conviene que quien vende lo
//  vea y lo confirme.
//
//  La regla: las dos se normalizan como en la competencia de Vallas
//  (`normalizarMarca`: sin acentos, sin signos ni espacios, minúsculas) y
//  COINCIDEN si una contiene a la otra. Sin marca o sin cliente no hay aviso.
// ============================================================================

describe('marcaCoincideConCliente', () => {
  it('la misma, con otras mayúsculas, acentos, signos o espacios, coincide', () => {
    expect(marcaCoincideConCliente('Coca-Cola', 'coca cola')).toBe(true)
    expect(marcaCoincideConCliente('  Telcel ', 'TELCEL')).toBe(true)
    expect(marcaCoincideConCliente('Liverpool', 'Liverpoól')).toBe(true)
  })

  it('una contiene a la otra, en cualquier sentido → coincide', () => {
    expect(marcaCoincideConCliente('Coca-Cola', 'Coca Cola FEMSA')).toBe(true)
    expect(marcaCoincideConCliente('Grupo Bimbo S.A.B.', 'Bimbo')).toBe(true)
  })

  it('distintas → no coincide', () => {
    expect(marcaCoincideConCliente('Pepsi', 'Publicis México')).toBe(false)
    expect(marcaCoincideConCliente('Palacio de Hierro', 'Liverpool')).toBe(false)
  })
})

describe('marcaNoCoincideConCliente (¿se avisa?)', () => {
  it('marca escrita que no se parece al cliente → sí', () => {
    expect(marcaNoCoincideConCliente('Pepsi', 'Publicis México')).toBe(true)
  })

  it('sin marca, o marca en blanco → no (cuenta el cliente)', () => {
    expect(marcaNoCoincideConCliente(null, 'Publicis México')).toBe(false)
    expect(marcaNoCoincideConCliente('', 'Publicis México')).toBe(false)
    expect(marcaNoCoincideConCliente('   ', 'Publicis México')).toBe(false)
  })

  it('sin cliente → no (no hay con qué comparar)', () => {
    expect(marcaNoCoincideConCliente('Pepsi', null)).toBe(false)
    expect(marcaNoCoincideConCliente('Pepsi', undefined)).toBe(false)
    expect(marcaNoCoincideConCliente('Pepsi', '')).toBe(false)
  })

  it('una marca hecha solo de signos no se compara (normalizada queda vacía)', () => {
    expect(marcaNoCoincideConCliente('***', 'Publicis México')).toBe(false)
  })

  it('coincidentes → no', () => {
    expect(marcaNoCoincideConCliente('Coca-Cola', 'Coca Cola FEMSA')).toBe(false)
  })
})

describe('cambioDeMarca (lo que la ficha manda al guardar)', () => {
  it('sin cambio real (solo espacios alrededor) → nada que mandar', () => {
    expect(cambioDeMarca('Pepsi ', 'Pepsi')).toBeNull()
    expect(cambioDeMarca('', null)).toBeNull()
    expect(cambioDeMarca('   ', null)).toBeNull()
  })

  it('una marca nueva va recortada', () => {
    expect(cambioDeMarca('  Pepsi  ', null)).toEqual({ marca: 'Pepsi' })
    expect(cambioDeMarca('Pepsi Black', 'Pepsi')).toEqual({ marca: 'Pepsi Black' })
  })

  it('vaciarla manda null: la quita y vuelve a contar el cliente', () => {
    expect(cambioDeMarca('', 'Pepsi')).toEqual({ marca: null })
    expect(cambioDeMarca('  ', 'Pepsi')).toEqual({ marca: null })
  })
})
