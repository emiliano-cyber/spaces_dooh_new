import { describe, it, expect } from 'vitest'
import { spotsDeLaReserva } from './spots-reserva'

// ============================================================================
//  DATA-02 — cuántos slots retiene una reserva.
// ----------------------------------------------------------------------------
//  El fallo completo está en la cabecera de `spots-reserva.ts`. Lo que estas
//  pruebas fijan es la DECISIÓN, para que no se pueda deshacer sin verla:
//  Jochelo eligió el 2026-08-27 que `spots_reservados` sea el total de slots
//  que la reserva RETIENE, no un acumulado de días.
// ============================================================================

describe('spotsDeLaReserva', () => {
  it('una pantalla estática queda en null: no ocupa slots de ningún loop', () => {
    expect(spotsDeLaReserva({ digital: false, pedidos: 4, disponibles: 12 })).toBe(null)
    expect(spotsDeLaReserva({ digital: false, pedidos: null, disponibles: null })).toBe(null)
  })

  it('una digital SIN cantidad pactada retiene 1, no null', () => {
    // El corazón del arreglo. «No se dijo cuántos» no significa «es una lona»,
    // y esa confusión es la que hacía que un solo creativo se quedara con toda
    // una pantalla vendida por propuesta.
    expect(spotsDeLaReserva({ digital: true, pedidos: null, disponibles: 12 })).toBe(1)
    expect(spotsDeLaReserva({ digital: true, disponibles: 12 })).toBe(1)
  })

  it('una digital CON cantidad retiene esa cantidad, acotada a lo libre', () => {
    expect(spotsDeLaReserva({ digital: true, pedidos: 4, disponibles: 12 })).toBe(4)
    expect(spotsDeLaReserva({ digital: true, pedidos: 40, disponibles: 12 })).toBe(12)
    // Sin slots libres retiene 0: no se inventa capacidad que la pantalla no
    // tiene. Cero no es null — la reserva existe, simplemente no tomó nada.
    expect(spotsDeLaReserva({ digital: true, pedidos: 4, disponibles: 0 })).toBe(0)
  })

  it('sin saber cuántos hay libres, no acota', () => {
    expect(spotsDeLaReserva({ digital: true, pedidos: 7, disponibles: null })).toBe(7)
  })

  it('NO acumula por días: 4 al día durante un mes siguen siendo 4 slots', () => {
    // La afirmación que impide el arreglo equivocado, y el motivo va escrito
    // porque el número por sí solo no lo explica: ese valor se SUMA de vuelta a
    // `sitios.spots_disponibles` con techo `total_spots`
    // (`campanas-repo.ts:254-262`). Un 4 × 30 = 120 contra un techo de 12
    // dejaría la pantalla marcada como libre aunque otras campañas la
    // ocuparan, y eso es sobreventa sin ningún error de por medio.
    expect(spotsDeLaReserva({ digital: true, pedidos: 4, disponibles: 12 })).toBe(4)
  })

  it('redondea una cantidad fraccionaria en vez de guardarla a medias', () => {
    // Un slot es indivisible. `reservas.spots_reservados` es `int`, así que sin
    // esto Postgres rechazaría la fila con un error que no dice nada del
    // negocio.
    expect(spotsDeLaReserva({ digital: true, pedidos: 3.4, disponibles: 12 })).toBe(3)
    expect(spotsDeLaReserva({ digital: true, pedidos: 3.6, disponibles: 12 })).toBe(4)
  })
})
