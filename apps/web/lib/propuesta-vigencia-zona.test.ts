import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { hoyDeVigencia, zonaDelNegocio, ZONA_DEL_NEGOCIO_POR_OMISION } from './propuesta-vigencia'

// ============================================================================
//  B88 · H4 (05/11) · LA ZONA DEL NEGOCIO, EXPLICITA.
// ----------------------------------------------------------------------------
//  `hoyDeVigencia()` leia el dia con los getters locales del proceso. Dos
//  problemas, los dos silenciosos:
//
//    · sin `TZ` en `app.env` el proceso cuenta en UTC: las propuestas
//      vencerian a las 18:00 de Mexico de su ultimo dia, sin un solo aviso;
//    · los getters locales dependen de que el runtime honre `TZ`, y no siempre
//      lo hace (en Windows, Node ignora `TZ=America/Los_Angeles` y se queda en
//      la zona del sistema: medido el 05/11).
//
//  Ahora el dia se calcula con `Intl` y la zona EXPLICITA: la de `TZ` si es
//  valida y, si falta o no es valida, `America/Mexico_City` (la zona del
//  negocio de la plantilla, `infra/env/app.env.example`), avisando UNA vez en
//  el log.
// ============================================================================

let tzAntes: string | undefined
let aviso: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  tzAntes = process.env.TZ
  aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.useFakeTimers({ toFake: ['Date'] })
})
afterEach(() => {
  vi.useRealTimers()
  aviso.mockRestore()
  if (tzAntes === undefined) delete process.env.TZ
  else process.env.TZ = tzAntes
})

describe('B88 · el dia de la vigencia se cuenta en la zona del negocio, explicita', () => {
  it('la zona por omision es la del negocio de la plantilla', () => {
    expect(ZONA_DEL_NEGOCIO_POR_OMISION).toBe('America/Mexico_City')
  })

  it('con TZ, manda TZ — aunque el runtime no la honre en sus getters locales', () => {
    // 07:30 UTC del 05/11 = 23:30 del 04/11 en Los Angeles (y 01:30 del 05 en Mexico).
    vi.setSystemTime(new Date('2026-11-05T07:30:00Z'))
    process.env.TZ = 'America/Los_Angeles'
    expect(zonaDelNegocio()).toBe('America/Los_Angeles')
    expect(hoyDeVigencia()).toBe('2026-11-04')
    process.env.TZ = 'UTC'
    expect(hoyDeVigencia()).toBe('2026-11-05')
    expect(aviso).not.toHaveBeenCalled()
  })

  it('NEGATIVO · SIN TZ no cuenta en UTC: cuenta en Mexico, y lo avisa una sola vez', () => {
    // 03:00 UTC del 05/11 = 21:00 del 04/11 en Mexico.
    vi.setSystemTime(new Date('2026-11-05T03:00:00Z'))
    delete process.env.TZ
    expect(zonaDelNegocio()).toBe('America/Mexico_City')
    expect(hoyDeVigencia()).toBe('2026-11-04')
    hoyDeVigencia()
    expect(aviso).toHaveBeenCalledTimes(1)
    expect(String(aviso.mock.calls[0]![0])).toMatch(/TZ/)
  })

  it('NEGATIVO · una TZ que no es una zona tampoco cae a UTC', () => {
    vi.setSystemTime(new Date('2026-11-05T03:00:00Z'))
    process.env.TZ = 'Marte/Olimpo'
    expect(zonaDelNegocio()).toBe('America/Mexico_City')
    expect(hoyDeVigencia()).toBe('2026-11-04')
  })

  it('la forma de glibc con dos puntos delante tambien vale', () => {
    process.env.TZ = ':America/Mexico_City'
    expect(zonaDelNegocio()).toBe('America/Mexico_City')
  })

  it('pasada la medianoche de Mexico, ya es el dia siguiente', () => {
    vi.setSystemTime(new Date('2026-11-05T06:30:00Z')) // 00:30 del 05/11 en Mexico
    process.env.TZ = 'America/Mexico_City'
    expect(hoyDeVigencia()).toBe('2026-11-05')
  })
})
