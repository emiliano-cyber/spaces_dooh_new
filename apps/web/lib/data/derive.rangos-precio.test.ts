import { describe, it, expect } from 'vitest'
import { rangosDePrecio } from './derive'

// ============================================================================
//  Rangos del filtro de precio. Hallazgo M-6 de la auditoría QA del 04/08/2026.
//
//  Comercial ofrecía «≤ $8k · ≤ $15k · ≤ $25k» escritos a mano mientras TODO el
//  inventario está en $45 000+: las tres opciones devolvían cero resultados.
//  El arreglo de A-8 (contra qué columna comparaba el filtro) no tocó esto —
//  los rangos seguían inventados—, así que el hallazgo sobrevivió a su propio
//  cierre. De ahí que lo que se prueba aquí NO sea «devuelve tres números»,
//  sino las dos garantías cuya ausencia ES el defecto:
//
//    · cada corte devuelve algo (si no, es el defecto reaparecido);
//    · cada corte excluye algo (si no, es «Cualquier precio» con otro nombre).
// ============================================================================

// La distribución REAL de G500 el día de la auditoría: nueve pantallas a 45 000
// y tres a 85 000. Es el caso que hay que acertar.
const G500 = [...Array(9).fill(45_000), ...Array(3).fill(85_000)]

describe('rangosDePrecio — M-6', () => {
  it('no propone ningún corte por debajo del inventario real', () => {
    // El defecto exacto del informe: con todo en 45 000+, un corte en 8 000,
    // 15 000 o 25 000 deja la lista vacía.
    for (const corte of rangosDePrecio(G500)) {
      expect(G500.some((t) => t <= corte)).toBe(true)
    }
  })

  it('cada corte deja fuera al menos una pantalla', () => {
    const max = Math.max(...G500)
    for (const corte of rangosDePrecio(G500)) {
      expect(corte).toBeLessThan(max)
    }
  })

  it('en la distribución de G500 propone el corte que parte 9 / 3', () => {
    expect(rangosDePrecio(G500)).toEqual([45_000])
  })

  it('devuelve los cortes en orden ascendente y sin repetir', () => {
    const cortes = rangosDePrecio([10_000, 20_000, 30_000, 40_000, 50_000, 60_000])
    expect(cortes).toEqual([...cortes].sort((a, b) => a - b))
    expect(new Set(cortes).size).toBe(cortes.length)
  })

  it('propone como mucho tres cortes, aunque haya cien tarifas distintas', () => {
    const muchas = Array.from({ length: 100 }, (_, i) => (i + 1) * 1_000)
    expect(rangosDePrecio(muchas).length).toBeLessThanOrEqual(3)
  })

  // ─── Los casos en los que el filtro NO debe pintarse ───────────────────────

  it('sin inventario no hay cortes', () => {
    expect(rangosDePrecio([])).toEqual([])
  })

  it('con una sola pantalla no hay cortes: no habría nada que separar', () => {
    expect(rangosDePrecio([45_000])).toEqual([])
  })

  it('con todas al mismo precio no hay cortes', () => {
    // Cualquier corte devolvería las doce o ninguna. Un filtro que no puede
    // cambiar lo que se ve es ruido — mismo criterio que el paginador de M-7.
    expect(rangosDePrecio(Array(12).fill(45_000))).toEqual([])
  })

  it('ignora las tarifas sin capturar en vez de proponer un corte en cero', () => {
    // `tarifaDeSitio` devuelve 0 cuando la pantalla no tiene tarifa. Un corte
    // en 0 sería una opción que no devuelve nada.
    const cortes = rangosDePrecio([0, 0, 45_000, 85_000])
    expect(cortes.every((c) => c > 0)).toBe(true)
  })

  it('descarta valores no finitos sin romperse', () => {
    expect(() => rangosDePrecio([NaN, Infinity, 45_000, 85_000])).not.toThrow()
    expect(rangosDePrecio([NaN, Infinity, 45_000, 85_000]).every(Number.isFinite)).toBe(true)
  })

  // ─── Legibilidad: un cuartil crudo no se puede enseñar ─────────────────────

  it('redondea a una cifra legible, escalando el paso a la magnitud', () => {
    // Decenas de miles: múltiplos de 5 000. Cientos: no se saltan de escala.
    const altos = rangosDePrecio([46_333, 46_334, 46_335, 120_000])
    expect(altos.every((c) => c % 5_000 === 0)).toBe(true)

    const bajos = rangosDePrecio([8_200, 8_300, 8_400, 30_000])
    expect(bajos.every((c) => c < 10_000)).toBe(true)
  })

  it('no se queda sin cortes cuando el inventario es caro y está muy junto', () => {
    // Cuatro pantallas entre 1.2M y 1.45M. Con el paso grueso de esa magnitud
    // (500 000) los tres cuartiles suben al mismo 1.5M, que pasa del máximo y
    // se descarta: el filtro desaparecía pese a haber dispersión de sobra.
    const caras = [1_200_000, 1_300_000, 1_400_000, 1_450_000]
    const cortes = rangosDePrecio(caras)
    expect(cortes.length).toBeGreaterThan(0)
    for (const corte of cortes) {
      expect(caras.some((t) => t <= corte)).toBe(true) // devuelve algo
      expect(corte).toBeLessThan(Math.max(...caras)) // y excluye algo
    }
  })

  it('redondea SIEMPRE hacia arriba, para que el corte no pierda su propia pantalla', () => {
    // Hacia abajo, 46 333 → 45 000 dejaría fuera a la pantalla que originó el
    // corte y la opción volvería a devolver cero: el defecto, reaparecido.
    const tarifas = [46_333, 46_333, 46_333, 200_000]
    for (const corte of rangosDePrecio(tarifas)) {
      expect(tarifas.some((t) => t <= corte)).toBe(true)
    }
  })
})
