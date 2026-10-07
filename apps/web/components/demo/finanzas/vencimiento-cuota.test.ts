import { describe, it, expect } from 'vitest'
import { etiquetaVencimiento } from './vencimiento-cuota'

// ============================================================================
//  «Vencida» no puede salir junto a «Pagada» (06/10).
// ----------------------------------------------------------------------------
//  La columna «Vence» de la cobranza pintaba «(12d vencida)» en rojo mirando
//  SOLO la fecha. Una cuota pagada con fecha pasada salía con la insignia
//  «Pagada» y, al lado, «12d vencida»: la pantalla se contradecía a sí misma.
//  El estado que manda es el de la cuota; la fecha solo cuenta mientras se debe.
// ============================================================================

describe('la etiqueta del vencimiento de una cuota', () => {
  it('PAGADA con fecha pasada NO dice vencida', () => {
    const e = etiquetaVencimiento('PAGADA', -12)
    expect(e.texto).not.toMatch(/vencid/i)
    expect(e.tono).toBe('muted')
  })

  it('PAGADA dice que está pagada, sin días', () => {
    expect(etiquetaVencimiento('PAGADA', -12).texto).toBe('pagada')
    expect(etiquetaVencimiento('PAGADA', 40).texto).toBe('pagada')
  })

  it('sin pagar y con fecha pasada sí dice vencida, en rojo', () => {
    expect(etiquetaVencimiento('VENCIDA', -12)).toEqual({ texto: '12d vencida', tono: 'error' })
  })

  it('sin pagar y por vencer avisa en ámbar', () => {
    expect(etiquetaVencimiento('POR_VENCER', 5)).toEqual({ texto: '5d', tono: 'warning' })
  })

  it('al corriente, discreto', () => {
    expect(etiquetaVencimiento('AL_CORRIENTE', 45)).toEqual({ texto: '45d', tono: 'muted' })
  })
})
