import { describe, it, expect } from 'vitest'
import { periodosLibres, capacidadDe } from './network-disponibilidad'

// La regla es la del alta de reservas (`campanas-repo.ts`): si se separan, la
// app de Network ofrece fechas que luego no se pueden vender.

describe('periodosLibres', () => {
  it('sin reservas, todo el rango está libre', () => {
    expect(periodosLibres('2026-12-01', '2026-12-31', [], 1)).toEqual([
      { desde: '2026-12-01', hasta: '2026-12-31' },
    ])
  })

  it('una estática con una reserva en medio parte el rango en dos (bordes inclusivos)', () => {
    const r = [{ campanaId: 'A', desde: '2026-12-10', hasta: '2026-12-20' }]
    expect(periodosLibres('2026-12-01', '2026-12-31', r, 1)).toEqual([
      { desde: '2026-12-01', hasta: '2026-12-09' },
      { desde: '2026-12-21', hasta: '2026-12-31' },
    ])
  })

  it('una reserva que tapa todo el rango no deja nada libre', () => {
    const r = [{ campanaId: 'A', desde: '2026-11-01', hasta: '2027-01-31' }]
    expect(periodosLibres('2026-12-01', '2026-12-31', r, 1)).toEqual([])
  })

  it('una digital con tope 2 sigue libre con una campaña y se llena con dos', () => {
    const r = [
      { campanaId: 'A', desde: '2026-12-01', hasta: '2026-12-31' },
      { campanaId: 'B', desde: '2026-12-15', hasta: '2026-12-20' },
    ]
    expect(periodosLibres('2026-12-01', '2026-12-31', r, 2)).toEqual([
      { desde: '2026-12-01', hasta: '2026-12-14' },
      { desde: '2026-12-21', hasta: '2026-12-31' },
    ])
  })

  it('dos reservas de la MISMA campaña ocupan un solo slot, como el count(distinct) del alta', () => {
    const r = [
      { campanaId: 'A', desde: '2026-12-01', hasta: '2026-12-31' },
      { campanaId: 'A', desde: '2026-12-10', hasta: '2026-12-12' },
    ]
    expect(periodosLibres('2026-12-01', '2026-12-31', r, 2)).toEqual([
      { desde: '2026-12-01', hasta: '2026-12-31' },
    ])
  })

  it('sin tope (digital sin total_spots) siempre está libre', () => {
    const r = [{ campanaId: 'A', desde: '2026-12-01', hasta: '2026-12-31' }]
    expect(periodosLibres('2026-12-01', '2026-12-31', r, null)).toEqual([
      { desde: '2026-12-01', hasta: '2026-12-31' },
    ])
  })

  it('un rango al revés no devuelve nada', () => {
    expect(periodosLibres('2026-12-31', '2026-12-01', [], 1)).toEqual([])
  })
})

describe('capacidadDe', () => {
  it('estática = 1; digital = total_spots; digital sin total = sin tope', () => {
    expect(capacidadDe('ESPECTACULAR', 6)).toBe(1)
    expect(capacidadDe('PANTALLA_DIGITAL', 6)).toBe(6)
    expect(capacidadDe('PANTALLA_DIGITAL', null)).toBeNull()
  })
})
