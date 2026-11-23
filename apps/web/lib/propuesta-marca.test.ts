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
//  COINCIDEN si una contiene a la otra (desde 4 caracteres; ver abajo). Sin
//  marca o sin cliente no hay aviso.
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

// ============================================================================
//  Decisión del dueño (20/11 noche): «que avise de más, no de menos». Una marca
//  CORTA («GM», «A») cabe dentro de casi cualquier nombre de cliente y con la
//  contención a secas no avisaba nunca. Ahora la contención solo cuenta si la
//  más corta, normalizada, tiene AL MENOS 4 caracteres; si es más corta, solo
//  coinciden si son iguales. Si avisa de más, el Dueño o el Administrador lo
//  corrigen.
// ============================================================================
describe('marcas cortas: la contención solo cuenta desde 4 caracteres', () => {
  it('«GM» vs «General Motors» → avisa (una sigla no cuenta como contenida)', () => {
    expect(marcaNoCoincideConCliente('GM', 'General Motors')).toBe(true)
  })

  it('«GM» vs «GM» → no avisa (iguales)', () => {
    expect(marcaNoCoincideConCliente('GM', 'GM')).toBe(false)
    expect(marcaNoCoincideConCliente('g.m.', 'GM')).toBe(false)
  })

  it('«A» dentro de cualquier cliente ya no coincide', () => {
    expect(marcaNoCoincideConCliente('A', 'Publicis México')).toBe(true)
    expect(marcaCoincideConCliente('A', 'Aeroméxico')).toBe(false)
  })

  it('«GM» dentro de «GM Financial» → avisa también (corta y no igual)', () => {
    expect(marcaNoCoincideConCliente('GM', 'GM Financial')).toBe(true)
  })

  it('4 caracteres o más: la contención sigue valiendo, en los dos sentidos', () => {
    expect(marcaNoCoincideConCliente('Coca-Cola', 'Coca Cola FEMSA')).toBe(false)
    expect(marcaNoCoincideConCliente('Bimbo', 'Grupo Bimbo')).toBe(false)
    expect(marcaNoCoincideConCliente('Grupo Bimbo', 'Bimbo')).toBe(false)
    expect(marcaNoCoincideConCliente('Ford', 'Ford Motor Company')).toBe(false)
  })

  it('el límite es la normalizada: «A.D.O» (3) no basta; «Ados» (4) sí', () => {
    expect(marcaNoCoincideConCliente('A.D.O', 'ADO Autobuses')).toBe(true)
    expect(marcaNoCoincideConCliente('Ados', 'ADOS Autobuses')).toBe(false)
  })

  it('«Pepsi» vs «Publicis México» → avisa', () => {
    expect(marcaNoCoincideConCliente('Pepsi', 'Publicis México')).toBe(true)
  })
})
