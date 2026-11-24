import { describe, it, expect } from 'vitest'
import { cuadrosFaltantes, MEDIDA_POR_CAPTURAR } from './cuadros-de-sitio'

// ============================================================================
//  Dueño, 24/11: «del inventario se tiene que ver como el resto … en su propio
//  módulo es donde se tiene que ver detallado». Todo sitio tipo VALLA aparece
//  en Vallas con un cuadro por cara, sin que nadie los dé de alta a mano.
// ============================================================================

const sitio = (p: Partial<Parameters<typeof cuadrosFaltantes>[0][number]> & { id: string }) => ({
  tipoMedio: 'VALLA',
  caras: 1,
  ancho: 8,
  alto: 3,
  baja: false,
  ...p,
})

describe('cuadrosFaltantes', () => {
  it('un sitio VALLA sin cuadros recibe uno por cara, con las medidas del sitio', () => {
    const r = cuadrosFaltantes([sitio({ id: 's1', caras: 2 })], [])
    expect(r).toEqual([
      { sitioId: 's1', numero: 'V-001', cara: 1, ancho: 8, alto: 3, notas: null },
      { sitioId: 's1', numero: 'V-002', cara: 2, ancho: 8, alto: 3, notas: null },
    ])
  })

  it('un sitio que YA tiene algún cuadro no se toca', () => {
    const r = cuadrosFaltantes([sitio({ id: 's1', caras: 2 })], [{ sitioId: 's1', numero: 'X-1' }])
    expect(r).toEqual([])
  })

  it('solo VALLA: espectaculares, digitales y lo demás se quedan fuera', () => {
    const r = cuadrosFaltantes(
      [sitio({ id: 'e', tipoMedio: 'ESPECTACULAR' }), sitio({ id: 'd', tipoMedio: 'PANTALLA_DIGITAL' }), sitio({ id: 'v' })],
      [],
    )
    expect(r.map((c) => c.sitioId)).toEqual(['v'])
  })

  it('un sitio dado de BAJA no recibe cuadros', () => {
    expect(cuadrosFaltantes([sitio({ id: 's1', baja: true })], [])).toEqual([])
  })

  it('la numeración sigue a la que ya hay en la organización, sin chocar', () => {
    const r = cuadrosFaltantes(
      [sitio({ id: 'a' }), sitio({ id: 'b', caras: 2 })],
      [{ sitioId: 'otro', numero: 'V-007' }, { sitioId: 'otro', numero: 'DEMO-V01' }],
    )
    expect(r.map((c) => c.numero)).toEqual(['V-008', 'V-009', 'V-010'])
  })

  it('sin medida en el sitio no se inventa una: 1 × 1 y una nota que lo dice', () => {
    const [c] = cuadrosFaltantes([sitio({ id: 's1', ancho: null, alto: 0 })], [])
    expect(c.ancho).toBe(1)
    expect(c.alto).toBe(1)
    expect(c.notas).toBe(MEDIDA_POR_CAPTURAR)
  })

  it('caras raras (0, nula, de más) quedan entre 1 y 50, como pide la base', () => {
    expect(cuadrosFaltantes([sitio({ id: 'a', caras: 0 })], [])).toHaveLength(1)
    expect(cuadrosFaltantes([sitio({ id: 'a', caras: null })], [])).toHaveLength(1)
    expect(cuadrosFaltantes([sitio({ id: 'a', caras: 80 })], [])).toHaveLength(50)
  })

  it('el mismo inventario da siempre los mismos números (dos pestañas abiertas no duplican)', () => {
    const s = [sitio({ id: 'b' }), sitio({ id: 'a' })]
    expect(cuadrosFaltantes(s, [])).toEqual(cuadrosFaltantes([...s].reverse(), []))
  })
})
