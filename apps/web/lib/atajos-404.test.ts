import { describe, it, expect } from 'vitest'
import { ATAJOS_404, CLAVES_ATAJOS_404 } from './atajos-404'
import { NAV, GRUPOS } from '@/components/demo/shell/nav'

// ============================================================================
//  Los atajos de la 404 se derivan de NAV, y esto vigila el empalme.
// ----------------------------------------------------------------------------
//  `ATAJOS_404` filtra las claves que no encuentra en vez de lanzar, para no
//  convertir un 404 en un 500 (ver el porqué en `atajos-404.ts`). El precio de
//  esa decisión es que un desajuste sería MUDO: alguien renombra la clave
//  `campanas` en `nav.ts` y la rejilla pasa a tener ocho atajos sin que nada
//  chille. Estas pruebas son el aviso que se cambió por el silencio.
// ============================================================================

describe('1 · el empalme con NAV', () => {
  it('las nueve claves existen en NAV', () => {
    // La que importa. Si se rompe, la rejilla perdió un atajo en silencio.
    for (const clave of CLAVES_ATAJOS_404) {
      expect(
        NAV.some((n) => n.key === clave),
        `«${clave}» no existe en NAV: la 404 perdería ese atajo sin avisar`,
      ).toBe(true)
    }
  })

  it('no se pierde ninguno por el camino', () => {
    expect(ATAJOS_404).toHaveLength(CLAVES_ATAJOS_404.length)
  })

  it('las etiquetas y las rutas salen de NAV, no reescritas a mano', () => {
    // Si alguien «arregla» un texto aquí en vez de en `nav.ts`, el menú y la
    // 404 empiezan a llamar distinto a la misma pantalla.
    for (const atajo of ATAJOS_404) {
      const enNav = NAV.find((n) => n.key === atajo.key)
      expect(atajo.label).toBe(enNav?.label)
      expect(atajo.href).toBe(enNav?.href)
      expect(atajo.icon).toBe(enNav?.icon)
    }
  })
})

describe('2 · la rejilla es una salida de emergencia útil', () => {
  it('no repite atajos', () => {
    expect(new Set(CLAVES_ATAJOS_404).size).toBe(CLAVES_ATAJOS_404.length)
    expect(new Set(ATAJOS_404.map((a) => a.href)).size).toBe(ATAJOS_404.length)
  })

  it('Dashboard va primero, igual que en el menú', () => {
    expect(ATAJOS_404[0].key).toBe('dashboard')
  })

  it('toca TODAS las fases del proceso', () => {
    // El menú cuenta el proceso por fases (11/08). La rejilla es un resumen de
    // ese menú: si una fase entera se queda fuera, quien cayó en la 404 no
    // tiene puerta a ese tramo del negocio.
    const cubiertos = new Set(ATAJOS_404.map((a) => a.grupo))
    for (const g of GRUPOS) {
      expect(cubiertos.has(g.key), `ninguna atajo lleva a la fase «${g.key}»`).toBe(true)
    }
  })

  it('cabe en la rejilla de tres columnas sin dejar un hueco', () => {
    // Se pinta a 3 columnas en escritorio; un número no múltiplo de 3 deja la
    // última fila coja y se nota.
    expect(CLAVES_ATAJOS_404.length % 3).toBe(0)
  })
})
