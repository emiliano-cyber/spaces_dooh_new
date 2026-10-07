import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { folioBase } from './folio-venta'

// ============================================================================
//  FOLIO-VENTA (07/10) · la campaña lleva el folio de su venta, y cada
//  extensión le suma .1, .2…  `folioBase` devuelve el folio sin el tramo.
// ----------------------------------------------------------------------------
//  Hace falta porque algunas cosas tienen que seguir viendo LA MISMA campaña
//  aunque se haya extendido: la lista del CMS (DOOHMAIN) se nombra con el folio,
//  y si se nombrara con `PR-2026-0042.1` la extensión abriría una lista nueva
//  en el reproductor en vez de alargar la que ya está programada.
// ============================================================================

describe('folioBase', () => {
  it('quita el tramo de una extensión', () => {
    expect(folioBase('PR-2026-0042.1')).toBe('PR-2026-0042')
    expect(folioBase('PR-2026-0042.12')).toBe('PR-2026-0042')
  })

  it('deja igual un folio sin extender, sea de venta o de campaña suelta', () => {
    expect(folioBase('PR-2026-0042')).toBe('PR-2026-0042')
    expect(folioBase('RGB260807001')).toBe('RGB260807001')
  })

  it('solo quita un tramo numérico al final', () => {
    expect(folioBase('PR-2026-0042.a')).toBe('PR-2026-0042.a')
    expect(folioBase('')).toBe('')
  })
})

describe('quién tiene que usar el folio SIN tramo', () => {
  it('la publicación al CMS nombra la lista con folioBase, no con el folio extendido', () => {
    // Se afirma sobre el código porque publicar necesita el SDK del CMS y no
    // corre en las pruebas. Si alguien vuelve a escribir `list: camp.folio`,
    // cada extensión abriría una lista nueva en el reproductor.
    const src = readFileSync(join(__dirname, 'server', 'doohmain.ts'), 'utf8')
    expect(src).toMatch(/list: folioBase\(camp\.folio\)/)
    expect(src).not.toMatch(/list: camp\.folio\b/)
  })
})
