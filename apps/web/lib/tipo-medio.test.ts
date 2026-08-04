import { describe, it, expect } from 'vitest'
import { etiquetaTipoMedio, TIPO_MEDIO_LABEL } from './tipo-medio'
import type { TipoMedio } from './data/types'

describe('etiquetaTipoMedio', () => {
  it('traduce el enum que la tabla de Network pintaba crudo', () => {
    expect(etiquetaTipoMedio('PANTALLA_DIGITAL')).toBe('Pantalla digital')
  })

  it('cubre todos los valores del enum', () => {
    const todos: TipoMedio[] = [
      'ESPECTACULAR', 'PANTALLA_DIGITAL', 'PUENTE_PEATONAL',
      'MOBILIARIO_URBANO', 'MURAL', 'VALLA', 'OTRO',
    ]
    for (const t of todos) expect(TIPO_MEDIO_LABEL[t]).toBeTruthy()
  })

  it('degrada un tipo desconocido a texto legible, no al enum', () => {
    // Si la BD gana un tipo antes que la UI, se ve inacabado pero no roto.
    expect(etiquetaTipoMedio('PANTALLA_LED_CURVA')).toBe('Pantalla led curva')
  })

  it('devuelve raya cuando no hay tipo', () => {
    expect(etiquetaTipoMedio(null)).toBe('—')
    expect(etiquetaTipoMedio('')).toBe('—')
  })
})
