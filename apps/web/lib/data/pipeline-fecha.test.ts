import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { formatearFecha } from '@/lib/i18n/dinero'

// ============================================================================
//  OLA 6 · menor C del validador de la ola 5: el pipeline de una campaña
//  pintaba UN DIA ANTES una fecha de inicio sin hora.
// ----------------------------------------------------------------------------
//  `fechaInicio` llega como «2026-11-03» (una columna `date`). `new Date()` lee
//  esa forma como medianoche UTC, y en Mexico (UTC-6) es todavia el dia 2. Pasa
//  igual en los dos idiomas: «02/11» en español y «Nov 2» en ingles.
//
//  El arreglo esta en `lib/data/client.ts` (`isoDePaso`): una fecha SIN hora es
//  un dia del calendario y se lee en hora local. Las que traen hora (las
//  marcas de tiempo de reservas, creativos, OTs…) no cambian.
// ============================================================================

const TZ = process.env.TZ
beforeAll(() => {
  process.env.TZ = 'America/Mexico_City'
})
afterAll(() => {
  process.env.TZ = TZ
})

describe('pipeline · la fecha de cada paso', () => {
  it('una fecha sin hora sale ese mismo dia, en español y en ingles', async () => {
    const { isoDePaso, formatFechaLocal } = await import('./client')
    const iso = isoDePaso('2026-11-03')
    expect(formatFechaLocal(iso)).toBe('03/11')
    expect(formatearFecha(iso, 'en', { month: 'short', day: 'numeric' })).toBe('Nov 3')
  })

  it('el primer dia del mes no cae en el mes anterior', async () => {
    const { isoDePaso, formatFechaLocal } = await import('./client')
    expect(formatFechaLocal(isoDePaso('2026-12-01'))).toBe('01/12')
  })

  it('una marca de tiempo con hora no cambia', async () => {
    const { isoDePaso, formatFechaLocal } = await import('./client')
    for (const t of ['2026-11-03T05:30:00Z', '2026-11-03T05:30:00.000Z', '2026-11-03T12:00:00-06:00']) {
      expect(isoDePaso(t)).toBe(t)
    }
    // 05:30 UTC es el 2 de noviembre en Mexico: se pinta lo que se pintaba.
    expect(formatFechaLocal(isoDePaso('2026-11-03T05:30:00Z'))).toBe('02/11')
  })
})
