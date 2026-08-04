import { describe, it, expect } from 'vitest'
import { ubicacion } from './ubicacion'

// ============================================================================
//  Los dos casos que la auditoría A4 encontró en pantalla, más los bordes.
// ============================================================================

describe('ubicacion', () => {
  it('no imprime "null" cuando falta una parte', () => {
    // El caso exacto de la ficha: clave nula interpolada en la plantilla.
    expect(ubicacion([null, 'EDOMEX'], ' · ')).toBe('EDOMEX')
    expect(ubicacion([undefined, 'CDMX'])).toBe('CDMX')
  })

  it('no repite la alcaldía cuando ciudad trae el mismo valor', () => {
    expect(ubicacion(['EDOMEX', 'EDOMEX'])).toBe('EDOMEX')
  })

  it('compara sin distinguir mayúsculas ni espacios sobrantes', () => {
    expect(ubicacion(['Edomex', ' EDOMEX '])).toBe('Edomex')
  })

  it('conserva el orden y las partes distintas', () => {
    expect(ubicacion(['Tlalnepantla', 'EDOMEX', 'México'])).toBe('Tlalnepantla, EDOMEX, México')
  })

  it('devuelve cadena vacía si no queda nada, sin separadores huérfanos', () => {
    expect(ubicacion([null, '', '   '])).toBe('')
  })

  it('respeta el separador pedido', () => {
    expect(ubicacion(['EJ-001', 'EDOMEX'], ' · ')).toBe('EJ-001 · EDOMEX')
  })
})
