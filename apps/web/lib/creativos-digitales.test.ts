import { describe, it, expect } from 'vitest'
import { soloDigitales } from './creativos-digitales'

// ============================================================================
//  2026-09-30 · En Creativos no salen campañas de pantalla fija.
// ----------------------------------------------------------------------------
//  Pedido del dueño: «en creativos no deben de salir ninguna campaña de
//  pantalla fija». Digital es `tipoMedio === 'PANTALLA_DIGITAL'` —la misma
//  regla que `esDigital()` en lib/data/derive.ts—; todo lo demás (espectacular,
//  valla, mural) es fijo. NO se usa `spotsReservados != null`: una digital sin
//  slots capturados lo tiene a null y se tomaría por fija.
// ============================================================================

const sitios = [
  { id: 'd1', tipoMedio: 'PANTALLA_DIGITAL' },
  { id: 'd2', tipoMedio: 'PANTALLA_DIGITAL' },
  { id: 'f1', tipoMedio: 'ESPECTACULAR' },
  { id: 'f2', tipoMedio: 'MURAL' },
]
const campanas = [{ id: 'dig' }, { id: 'fija' }, { id: 'mixta' }, { id: 'sin-reservas' }]
const reservas = [
  { id: 'r1', campanaId: 'dig', sitioId: 'd1', spotsReservados: 12 },
  { id: 'r2', campanaId: 'fija', sitioId: 'f1', spotsReservados: null },
  { id: 'r3', campanaId: 'fija', sitioId: 'f2', spotsReservados: null },
  { id: 'r4', campanaId: 'mixta', sitioId: 'f1', spotsReservados: null },
  { id: 'r5', campanaId: 'mixta', sitioId: 'd2', spotsReservados: null }, // digital SIN slots
]

describe('soloDigitales', () => {
  const r = soloDigitales(campanas, reservas, sitios)

  it('una campaña con TODAS sus pantallas fijas no sale', () => {
    expect(r.campanas.map((c) => c.id)).not.toContain('fija')
  })

  it('una digital sí sale', () => {
    expect(r.campanas.map((c) => c.id)).toContain('dig')
  })

  it('una mixta sale, pero solo con sus reservas digitales', () => {
    expect(r.campanas.map((c) => c.id)).toContain('mixta')
    expect(r.reservas.filter((x) => x.campanaId === 'mixta').map((x) => x.id)).toEqual(['r5'])
  })

  it('una digital SIN slots capturados cuenta como digital (por eso no se mira spotsReservados)', () => {
    expect(r.reservas.map((x) => x.id)).toContain('r5')
  })

  it('ninguna reserva de pantalla fija sobrevive', () => {
    expect(r.reservas.map((x) => x.id).sort()).toEqual(['r1', 'r5'])
  })

  it('una campaña sin reservas se queda: no se sabe que sea fija', () => {
    expect(r.campanas.map((c) => c.id)).toContain('sin-reservas')
  })

  it('una reserva cuyo sitio no se conoce no se toma por digital', () => {
    const x = soloDigitales([{ id: 'c' }], [{ id: 'rx', campanaId: 'c', sitioId: 'nadie', spotsReservados: 5 }], sitios)
    expect(x.reservas).toEqual([])
    expect(x.campanas).toEqual([])
  })
})
