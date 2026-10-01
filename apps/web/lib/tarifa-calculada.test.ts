import { describe, it, expect } from 'vitest'
import { resolverTarifa, temporadaDeFecha, type Temporada } from './rejilla'
import { UNIDADES, type Unidad } from './periodos'
import {
  centavos,
  decidirPrecioItem,
  modalidadesDeSitio,
  tarifaCalculada,
  textoBitacoraAjusteTarifa,
  type SitioTarifable,
} from './tarifa-calculada'

// ============================================================================
//  LA TARIFA CALCULADA DE UNA LÍNEA — la MISMA cuenta en la pantalla y en el
//  servidor (hallazgo B40, decisión del dueño del 2026-10-01).
// ----------------------------------------------------------------------------
//  «En propuestas, aparte de ser calculado, el gerente será el único que podrá
//  poner otro precio diferente al de la tarifa, e igual usuarios superiores.»
//
//  Hasta hoy la cuenta vivía DENTRO de `propuestas/page.tsx` (`tarifaDe`), un
//  componente `'use client'`, y el servidor copiaba lo que le llegara. Para que
//  el servidor pueda rechazar un precio distinto de la tarifa, tiene que saber
//  cuál es la tarifa — y si la calculara con otra regla, la pantalla enseñaría
//  un número y el servidor exigiría otro, sin ningún error que lo explicara.
//
//  Por eso aquí hay DOS clases de prueba:
//   1. Que la función nueva da EXACTAMENTE lo que daba la pantalla antes, en
//      una matriz de casos. La regla vieja se copia abajo literal, como
//      referencia congelada: si alguien «mejora» la función, esto se pone rojo.
//   2. La regla de quién puede apartarse de la tarifa (`decidirPrecioItem`).
// ============================================================================

// ─── La regla de la pantalla ANTES de este cambio, copiada letra por letra ──
// (`app/(app)/(shell)/propuestas/page.tsx`, `modalidadesDe` y `tarifaDe`, en
// `650645c0`). No se importa de ninguna parte a propósito: es la foto de lo
// que había, y una foto no se actualiza.
const modalidadesDeAntes = (s: any): { unidad: Unidad; tarifa: number }[] => {
  const det = (s.modalidadesDetalle ?? []) as { unidad: string; tarifaPublicada: number }[]
  const validas = det
    .filter((m) => UNIDADES.some((u) => u.unidad === m.unidad))
    .map((m) => ({ unidad: m.unidad as Unidad, tarifa: Number(m.tarifaPublicada) || 0 }))
  if (validas.length) return validas
  return [{ unidad: 'mensual', tarifa: Number(s.tarifaPublicada || s.tarifaMensual || 0) }]
}
const tarifaDeAntes = (s: any, unidad: Unidad, temporadaId: string | null, franjaId?: string): number => {
  const base =
    modalidadesDeAntes(s).find((m) => m.unidad === unidad)?.tarifa ?? modalidadesDeAntes(s)[0].tarifa
  const filas = (
    (s.rejilla ?? []) as { unidad: string; franjaId: string | null; temporadaId: string | null; tarifa: number }[]
  ).filter((f) => f.unidad === unidad)
  if (!filas.length) return base
  return resolverTarifa({ tarifaBase: base, rejilla: filas, franjaId: franjaId || null, temporadaId }).tarifa
}

const TEMPORADAS: Temporada[] = [
  { id: 'T-BUENFIN', nombre: 'Buen Fin', desde: '2026-11-13', hasta: '2026-11-16' },
  { id: 'T-DIC', nombre: 'Diciembre', desde: '2026-12-01', hasta: '2026-12-31' },
]

const SIN_NADA: SitioTarifable = { tarifaPublicada: 0, tarifaMensual: 0 }
const SOLO_PUBLICADA: SitioTarifable = { tarifaPublicada: 45000, tarifaMensual: 40000 }
const SOLO_MENSUAL_VIEJA: SitioTarifable = { tarifaPublicada: 0, tarifaMensual: 38000 }
const CON_MODALIDADES: SitioTarifable = {
  tarifaPublicada: 45000,
  modalidadesDetalle: [
    { unidad: 'mensual', tarifaPublicada: 45000 },
    { unidad: 'spot', tarifaPublicada: 1200 },
    { unidad: 'semanal', tarifaPublicada: 0 },
    { unidad: 'inventada', tarifaPublicada: 99 },
  ],
}
const CON_REJILLA: SitioTarifable = {
  tarifaPublicada: 45000,
  modalidadesDetalle: [
    { unidad: 'mensual', tarifaPublicada: 45000 },
    { unidad: 'spot', tarifaPublicada: 1200 },
  ],
  rejilla: [
    { unidad: 'spot', franjaId: 'F-PRIME', temporadaId: null, tarifa: 1800 },
    { unidad: 'spot', franjaId: 'F-PRIME', temporadaId: 'T-BUENFIN', tarifa: 2500 },
    { unidad: 'spot', franjaId: null, temporadaId: 'T-DIC', tarifa: 1500 },
    { unidad: 'spot', franjaId: 'F-MADRUGADA', temporadaId: null, tarifa: 0 },
    { unidad: 'mensual', franjaId: null, temporadaId: null, tarifa: 50000 },
  ],
}

describe('tarifaCalculada da EXACTAMENTE lo que daba la pantalla', () => {
  const sitios = { SIN_NADA, SOLO_PUBLICADA, SOLO_MENSUAL_VIEJA, CON_MODALIDADES, CON_REJILLA }
  const fechas = ['', '2026-10-05', '2026-11-14', '2026-12-20']
  const franjas = ['', 'F-PRIME', 'F-MADRUGADA', 'F-INEXISTENTE']
  const unidades: Unidad[] = ['mensual', 'spot', 'semanal', 'hora']

  for (const [nombre, sitio] of Object.entries(sitios)) {
    it(`${nombre}: la matriz entera de unidad × franja × fecha`, () => {
      let casos = 0
      for (const unidad of unidades) {
        for (const franjaId of franjas) {
          for (const fecha of fechas) {
            const temporadaId = temporadaDeFecha(TEMPORADAS, fecha)
            const antes = tarifaDeAntes(sitio, unidad, temporadaId, franjaId)
            const ahora = tarifaCalculada({
              sitio,
              unidad,
              franjaId: franjaId || null,
              temporadas: TEMPORADAS,
              fechaInicio: fecha,
            }).tarifa
            expect(ahora, `${unidad} · ${franjaId || 'todo el día'} · ${fecha || 'sin fecha'}`).toBe(antes)
            casos++
          }
        }
      }
      // El arnés del arnés: que la matriz no se haya quedado vacía.
      expect(casos).toBe(unidades.length * franjas.length * fechas.length)
    })
  }

  it('modalidadesDeSitio es la misma lista que la de la pantalla', () => {
    for (const s of [SIN_NADA, SOLO_PUBLICADA, SOLO_MENSUAL_VIEJA, CON_MODALIDADES, CON_REJILLA]) {
      expect(modalidadesDeSitio(s)).toEqual(modalidadesDeAntes(s))
    }
  })
})

describe('tarifaCalculada · casos representativos con su número', () => {
  it('sin modalidades: la mensual sintética con la tarifa publicada', () => {
    const r = tarifaCalculada({ sitio: SOLO_PUBLICADA, unidad: 'mensual', temporadas: [], fechaInicio: '2026-10-05' })
    expect(r).toMatchObject({ tarifa: 45000, origen: 'modalidad', calculable: true })
  })

  it('el prime del Buen Fin gana a todo', () => {
    const r = tarifaCalculada({
      sitio: CON_REJILLA, unidad: 'spot', franjaId: 'F-PRIME', temporadas: TEMPORADAS, fechaInicio: '2026-11-14',
    })
    expect(r).toMatchObject({ tarifa: 2500, origen: 'franja+temporada', calculable: true, temporadaId: 'T-BUENFIN' })
  })

  it('la temporada se deduce de la fecha de INICIO', () => {
    const r = tarifaCalculada({ sitio: CON_REJILLA, unidad: 'spot', temporadas: TEMPORADAS, fechaInicio: '2026-12-20' })
    expect(r).toMatchObject({ tarifa: 1500, origen: 'temporada', temporadaId: 'T-DIC' })
  })

  it('un CERO de la rejilla es un precio capturado, y es calculable', () => {
    // `lib/rejilla.ts`: «Un CERO de la rejilla es un precio, no un hueco». La
    // madrugada regalada la decidió el dueño; el vendedor la puede vender así.
    const r = tarifaCalculada({
      sitio: CON_REJILLA, unidad: 'spot', franjaId: 'F-MADRUGADA', temporadas: TEMPORADAS, fechaInicio: '2026-10-05',
    })
    expect(r).toMatchObject({ tarifa: 0, origen: 'franja', calculable: true })
  })

  it('NEGATIVO · sin ninguna tarifa capturada NO es calculable', () => {
    const r = tarifaCalculada({ sitio: SIN_NADA, unidad: 'mensual', temporadas: [], fechaInicio: '2026-10-05' })
    expect(r.tarifa).toBe(0)
    expect(r.calculable).toBe(false)
  })

  it('NEGATIVO · una modalidad capturada en 0 NO es calculable', () => {
    const r = tarifaCalculada({ sitio: CON_MODALIDADES, unidad: 'semanal', temporadas: [], fechaInicio: '2026-10-05' })
    expect(r.calculable).toBe(false)
  })

  it('NEGATIVO · una unidad que la pantalla NO ofrece no es calculable, aunque la pantalla caiga a su primera tarifa', () => {
    // La pantalla solo ofrece en el selector las unidades de sus modalidades,
    // así que este caso solo se alcanza con un `curl`. El número es el de
    // siempre —la primera modalidad— para que la pantalla no cambie; lo que
    // cambia es que el servidor ya no lo trata como «la tarifa».
    const r = tarifaCalculada({ sitio: CON_MODALIDADES, unidad: 'hora', temporadas: [], fechaInicio: '2026-10-05' })
    expect(r.tarifa).toBe(45000)
    expect(r.calculable).toBe(false)
  })

  it('una fila de la rejilla para la unidad la hace calculable aunque no haya modalidad', () => {
    const sitio: SitioTarifable = {
      tarifaPublicada: 45000,
      rejilla: [{ unidad: 'spot', franjaId: null, temporadaId: null, tarifa: 900 }],
    }
    const r = tarifaCalculada({ sitio, unidad: 'spot', temporadas: [], fechaInicio: '2026-10-05' })
    expect(r).toMatchObject({ tarifa: 900, origen: 'rejilla', calculable: true })
  })
})

describe('centavos', () => {
  it('compara al centavo, no al flotante', () => {
    expect(centavos(0.1 + 0.2)).toBe(centavos(0.3))
    expect(centavos(1200)).toBe(120000)
    expect(centavos(1200.004)).toBe(centavos(1200))
    expect(centavos(1200.01)).not.toBe(centavos(1200))
  })
})

describe('decidirPrecioItem · quién puede apartarse de la tarifa', () => {
  const calc = (tarifa: number, calculable = true) => ({ tarifa, calculable })

  it('a la tarifa: vale para cualquiera, y NO queda como ajuste', () => {
    for (const puedeAjustar of [false, true]) {
      expect(decidirPrecioItem({ enviada: 1200, calculada: calc(1200), puedeAjustar })).toEqual({
        ok: true, tarifaCalculada: 1200, ajustado: false,
      })
    }
  })

  it('a la tarifa con ruido de flotante: sigue siendo la tarifa', () => {
    expect(decidirPrecioItem({ enviada: 0.1 + 0.2, calculada: calc(0.3), puedeAjustar: false }).ok).toBe(true)
  })

  it('NEGATIVO · distinta y SIN permiso: se rechaza', () => {
    expect(decidirPrecioItem({ enviada: 1, calculada: calc(1200), puedeAjustar: false })).toEqual({
      ok: false, motivo: 'distinta',
    })
    // Un centavo arriba también: el candado no es solo contra bajar el precio.
    expect(decidirPrecioItem({ enviada: 1200.01, calculada: calc(1200), puedeAjustar: false }).ok).toBe(false)
  })

  it('distinta CON permiso: se acepta, guarda la tarifa calculada y queda como ajuste', () => {
    expect(decidirPrecioItem({ enviada: 900, calculada: calc(1200), puedeAjustar: true })).toEqual({
      ok: true, tarifaCalculada: 1200, ajustado: true,
    })
  })

  it('NEGATIVO · sin tarifa calculable y SIN permiso: se rechaza, aunque mande 0', () => {
    expect(decidirPrecioItem({ enviada: 0, calculada: calc(0, false), puedeAjustar: false })).toEqual({
      ok: false, motivo: 'sin-tarifa',
    })
    expect(decidirPrecioItem({ enviada: 45000, calculada: calc(45000, false), puedeAjustar: false }).ok).toBe(false)
  })

  it('sin tarifa calculable CON permiso: el gerente le pone precio, sin tarifa que guardar', () => {
    expect(decidirPrecioItem({ enviada: 30000, calculada: calc(0, false), puedeAjustar: true })).toEqual({
      ok: true, tarifaCalculada: null, ajustado: true,
    })
  })
})

describe('textoBitacoraAjusteTarifa · lo que queda en Actividad', () => {
  it('con tarifa: la pantalla, la tarifa calculada y el precio nuevo', () => {
    const t = textoBitacoraAjusteTarifa({ sitioNombre: 'Pantalla Reforma', unidad: 'spot', tarifaCalculada: 1200, tarifa: 900 })
    expect(t).toMatch(/^Cambió la tarifa/)
    expect(t).toContain('Pantalla Reforma')
    expect(t).toContain('1,200')
    expect(t).toContain('900')
  })

  it('ADR 0042 · un Roadblock con prima lo dice, con el porcentaje', () => {
    const t = textoBitacoraAjusteTarifa({
      sitioNombre: 'Pantalla Reforma',
      unidad: 'spot',
      tarifaCalculada: 1200,
      tarifa: 1500,
      primaRoadblockPct: 25,
    })
    expect(t).toBe('Cambió la tarifa de «Pantalla Reforma» (spot) de $1,200 a $1,500 por Roadblock con prima del 25 % en la propuesta')
    // Sin prima, el texto de siempre: la prima 0 no es un Roadblock que contar.
    expect(
      textoBitacoraAjusteTarifa({ sitioNombre: 'P', unidad: 'spot', tarifaCalculada: 1200, tarifa: 900, primaRoadblockPct: 0 }),
    ).toBe('Cambió la tarifa de «P» (spot) de $1,200 a $900 en la propuesta')
  })

  it('sin tarifa calculada: lo dice, en vez de inventar un «de $0»', () => {
    const t = textoBitacoraAjusteTarifa({ sitioNombre: 'Pantalla B', unidad: 'mensual', tarifaCalculada: null, tarifa: 30000 })
    expect(t).toContain('sin tarifa calculada')
    expect(t).toContain('30,000')
    expect(t).not.toContain('$0')
  })
})
