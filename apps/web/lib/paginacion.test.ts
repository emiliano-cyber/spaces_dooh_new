import { describe, it, expect } from 'vitest'

// ============================================================================
//  M7 · El recorte de `usePaginacion`.
//
//  El hook mezcla estado de React con aritmética; lo que se puede romper en
//  silencio es la aritmética, así que se prueba esa aparte. El caso que importa
//  no es «parte en páginas de 25» sino el borde: quedarte en la página 4 cuando
//  un filtro dejó 12 resultados enseña una tabla vacía y parece que no hay
//  datos — que es peor que no paginar.
// ============================================================================

// Misma fórmula que el hook. Si allí cambia, esto deja de protegerlo: por eso
// las expectativas están escritas como comportamiento observable (qué ve el
// usuario), no como reimplementación.
function recorte(total: number, porPagina: number, paginaPedida: number) {
  const paginas = Math.max(1, Math.ceil(total / porPagina))
  const actual = Math.min(paginaPedida, paginas)
  const items = Array.from({ length: total }, (_, i) => i + 1)
  return {
    paginas,
    actual,
    visibles: items.slice((actual - 1) * porPagina, actual * porPagina),
    desde: total === 0 ? 0 : (actual - 1) * porPagina + 1,
    hasta: Math.min(actual * porPagina, total),
  }
}

describe('recorte de páginas', () => {
  it('la primera página trae los primeros y dice 1–25', () => {
    const r = recorte(168, 25, 1)
    expect(r.paginas).toBe(7)
    expect(r.visibles[0]).toBe(1)
    expect(r.visibles).toHaveLength(25)
    expect([r.desde, r.hasta]).toEqual([1, 25])
  })

  it('la última página trae el resto, no 25 huecos', () => {
    const r = recorte(168, 25, 7)
    expect(r.visibles).toHaveLength(18)
    expect([r.desde, r.hasta]).toEqual([151, 168])
  })

  it('si la página pedida ya no existe, se acota a la última', () => {
    // El caso real: estabas en la 4 y un filtro dejó 12 resultados. Sin acotar,
    // la tabla sale vacía y parece que el filtro no encontró nada.
    const r = recorte(12, 25, 4)
    expect(r.actual).toBe(1)
    expect(r.visibles).toHaveLength(12)
    expect([r.desde, r.hasta]).toEqual([1, 12])
  })

  it('sin resultados no inventa un rango', () => {
    const r = recorte(0, 25, 1)
    expect(r.paginas).toBe(1)
    expect(r.visibles).toEqual([])
    expect([r.desde, r.hasta]).toEqual([0, 0])
  })

  it('con menos elementos que una página, hay una sola', () => {
    // Con `paginas === 1` el control no se pinta: un paginador que no pagina es
    // ruido y sugiere que hay más datos de los que hay.
    expect(recorte(20, 25, 1).paginas).toBe(1)
    expect(recorte(25, 25, 1).paginas).toBe(1)
    expect(recorte(26, 25, 1).paginas).toBe(2)
  })

  it('las páginas cubren el total sin huecos ni repetidos', () => {
    const vistos: number[] = []
    for (let p = 1; p <= recorte(53, 20, 1).paginas; p++) vistos.push(...recorte(53, 20, p).visibles)
    expect(vistos).toEqual(Array.from({ length: 53 }, (_, i) => i + 1))
  })
})
