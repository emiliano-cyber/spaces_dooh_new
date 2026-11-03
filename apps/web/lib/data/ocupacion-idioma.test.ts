import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ocupacionSerie, type Granularidad } from './derive'
import type { DemoState } from './types'

// ============================================================================
//  El eje de la grafica de ocupacion en los dos idiomas (lote de ingles
//  «reportes», segunda vuelta del validador, hallazgo H-T1).
// ----------------------------------------------------------------------------
//  `ocupacionSerie` y `useOcupacionSerie` ganaron `idioma` ('es' por omision),
//  y nada lo vigilaba: quitar el idioma en cualquiera de las dos sobrevivia
//  (mutantes M3c y M3d). Aqui se fija que:
//
//    (a) en ingles las ETIQUETAS salen en ingles;
//    (b) los NUMEROS (`pct`, `ocupados`, los dias) son los mismos que en
//        espanol: el idioma no puede tocar el calculo;
//    (c) sin idioma sale exactamente lo de `'es'`.
//
//  El hook se rinde de verdad (`renderToStaticMarkup`). Sin DOM, el
//  `useMounted` del hook devolveria `undefined` para siempre, asi que se fuerza
//  su `useState(false)` a `true`: es lo unico que se toca de React.
// ============================================================================

vi.mock('react', async (importOriginal) => {
  const real = await importOriginal<typeof import('react')>()
  function useState(inicial?: unknown) {
    return real.useState(inicial === false ? true : inicial)
  }
  return { ...real, default: { ...real, useState }, useState }
})

const dia = (offset: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString()
}
const ESTADO = {
  sitios: [
    { id: 'd1', tipoMedio: 'PANTALLA_DIGITAL', totalSpots: 4, estatusComercial: 'DISPONIBLE' },
    { id: 'f1', tipoMedio: 'ESPECTACULAR', totalSpots: null, estatusComercial: 'DISPONIBLE' },
  ],
  reservas: [
    { id: 'r1', sitioId: 'd1', campanaId: 'c1', estatus: 'CONFIRMADA', fechaInicio: dia(-1), fechaFin: dia(60) },
    { id: 'r2', sitioId: 'f1', campanaId: 'c2', estatus: 'CONFIRMADA', fechaInicio: dia(20), fechaFin: dia(200) },
  ],
} as unknown as DemoState

const GRANULARIDADES: Granularidad[] = ['dia', 'semana', 'mes', 'trimestre']
const numeros = (s: ReturnType<typeof ocupacionSerie>) => ({
  puntos: s.puntos.map((p) => [p.pct, p.ocupados]),
  diasOcupados: s.diasOcupados,
  diasDisponibles: s.diasDisponibles,
})

beforeEach(() => {
  vi.useFakeTimers()
  // 02/11/2026: los buckets de mes y trimestre caen en noviembre y en T4.
  vi.setSystemTime(new Date(2026, 10, 2, 12))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('ocupacionSerie · el idioma solo cambia las etiquetas', () => {
  it('en ingles las etiquetas salen en ingles', () => {
    expect(ocupacionSerie(ESTADO, 'trimestre', 'en').puntos[0].label).toBe('Q4 2026')
    expect(ocupacionSerie(ESTADO, 'mes', 'en').puntos[0].label).toBe('Nov')
    expect(ocupacionSerie(ESTADO, 'semana', 'en').puntos[0].label).toBe('Nov 2')
    expect(ocupacionSerie(ESTADO, 'trimestre').puntos[0].label).toBe('T4 2026')
    expect(ocupacionSerie(ESTADO, 'semana').puntos[0].label).toBe('02/11')
  })

  it('los numeros son los mismos en los dos idiomas, en las cuatro granularidades', () => {
    for (const g of GRANULARIDADES) {
      const es = ocupacionSerie(ESTADO, g, 'es')
      const en = ocupacionSerie(ESTADO, g, 'en')
      expect(numeros(en)).toEqual(numeros(es))
      // Y la serie no es trivial: hay ocupacion que comparar.
      expect(es.diasOcupados).toBeGreaterThan(0)
    }
  })

  it('sin idioma sale exactamente lo de `es`', () => {
    for (const g of GRANULARIDADES) expect(ocupacionSerie(ESTADO, g)).toEqual(ocupacionSerie(ESTADO, g, 'es'))
  })
})

describe('useOcupacionSerie · pasa el idioma a la serie', () => {
  it('en ingles el hook devuelve las etiquetas inglesas y los mismos numeros', async () => {
    const { useDemoStore } = await import('./store')
    const { useOcupacionSerie } = await import('./client')
    useDemoStore.setState(ESTADO as never)
    const pinta = (idioma?: 'es' | 'en') => {
      // Dos componentes y no un `if`: el hook se llama siempre igual en cada uno.
      function EjeConIdioma({ i }: { i: 'es' | 'en' }) {
        const serie = useOcupacionSerie('trimestre', i)
        return createElement('p', null, serie ? JSON.stringify(serie) : 'sin-serie')
      }
      function EjeSinIdioma() {
        const serie = useOcupacionSerie('trimestre')
        return createElement('p', null, serie ? JSON.stringify(serie) : 'sin-serie')
      }
      const el = idioma ? createElement(EjeConIdioma, { i: idioma }) : createElement(EjeSinIdioma)
      return renderToStaticMarkup(el).replace(/&quot;/g, '"').replace(/^<p>|<\/p>$/g, '')
    }
    const en = JSON.parse(pinta('en')) as ReturnType<typeof ocupacionSerie>
    const es = JSON.parse(pinta('es')) as ReturnType<typeof ocupacionSerie>
    expect(en.puntos.map((p) => p.label)[0]).toBe('Q4 2026')
    expect(es.puntos.map((p) => p.label)[0]).toBe('T4 2026')
    expect(numeros(en)).toEqual(numeros(es))
    expect(pinta()).toBe(pinta('es'))
  })
})
