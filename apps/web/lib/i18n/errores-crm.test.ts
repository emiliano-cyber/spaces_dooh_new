import { describe, it, expect } from 'vitest'
import { traducirError } from './errores-servidor'

// ADR 0051 · Fase 4. Borrar un cliente con oportunidades ahora lo dice en el
// desglose, y «oportunidades» hace el plural en -es: quitarle la s, como a las
// demás piezas, daba «oportunidade» y la pieza no se reconocía.
const msg = (piezas: string) =>
  `No se puede borrar: el cliente tiene ${piezas}. Quítalos o reasígnalos antes de borrarlo.`

describe('el bloqueo de borrar un cliente, con oportunidades', () => {
  it('en inglés', () => {
    expect(traducirError(msg('1 campaña y 2 oportunidades'), 'en')).toBe(
      'Cannot delete: the client has 1 campaign and 2 opportunities. Remove or reassign them before deleting it.',
    )
    expect(traducirError(msg('1 oportunidad'), 'en')).toContain('1 opportunity.')
  })

  it('en italiano', () => {
    expect(traducirError(msg('2 oportunidades'), 'it')).toContain('2 opportunità')
  })

  it('en portugués', () => {
    expect(traducirError(msg('1 oportunidad'), 'pt')).toContain('1 oportunidade')
    expect(traducirError(msg('3 oportunidades'), 'pt')).toContain('3 oportunidades')
  })
})
