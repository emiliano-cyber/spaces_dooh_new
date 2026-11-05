import { describe, it, expect } from 'vitest'
import { DICCIONARIOS } from '../diccionario'
import { CATALOGO_ERRORES_IT, CAMPO_IT, CATALOGO_ERRORES, CAMPO_EN } from '../errores-servidor'

// ============================================================================
//  Cierre de idiomas (04/11) · «comisión» es SIEMPRE «provvigione» en italiano.
// ----------------------------------------------------------------------------
//  El menu decia «Provvigioni» y las paginas de comisiones, propuestas y
//  reportes «commissione d’agenzia»: la misma cosa con dos nombres. Decision
//  del dueno: «provvigione/provvigioni» en todo, con su concordancia femenina
//  («la provvigione dell’agenzia»). Glosario en `vault/03-Frontend/italiano-olas.md`.
// ============================================================================

const IT = DICCIONARIOS.it as Record<string, string>
const ES = DICCIONARIOS.es as Record<string, string>

describe('«comisión» se dice «provvigione» en todo el italiano', () => {
  const claves = Object.keys(ES).filter((k) => /comisi[oó]n/i.test(ES[k]))

  it('hay claves que lo dicen (la prueba mira algo)', () => {
    expect(claves.length).toBeGreaterThan(20)
  })

  it.each(claves)('%s', (k) => {
    expect(IT[k]).toMatch(/provvigion[ei]/i)
    expect(IT[k]).not.toMatch(/commission/i)
    // «la provvigione dell’agenzia», nunca «d’agenzia» (concordancia y glosario).
    expect(IT[k]).not.toMatch(/provvigione d’agenzia/i)
  })

  it('ninguna clave italiana dice «commissione», diga lo que diga el espanol', () => {
    expect(Object.entries(IT).filter(([, v]) => /commission[ei]\b/i.test(v))).toEqual([])
  })

  it('los catalogos italianos del servidor tampoco', () => {
    for (const cat of [CATALOGO_ERRORES_IT, CAMPO_IT]) {
      expect(Object.values(cat).filter((v) => /commission/i.test(v ?? ''))).toEqual([])
    }
    // Y el campo «Comisión» del servidor, como el menu.
    expect(CAMPO_IT['Comisión'] ?? CATALOGO_ERRORES_IT['Comisión']).toBe('Provvigione')
    // El ingles no cambia: sigue «Commission».
    expect(CAMPO_EN['Comisión'] ?? CATALOGO_ERRORES['Comisión']).toBe('Commission')
  })
})
