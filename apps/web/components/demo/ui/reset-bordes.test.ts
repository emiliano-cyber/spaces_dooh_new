import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ============================================================================
//  El reset de `demo.css` no puede pisar a las utilidades de borde
// ----------------------------------------------------------------------------
//  QUE SE AFIRMA AQUI, dicho con precision, porque es facil prometer de mas:
//
//  El reset scoped y una utilidad de Tailwind (`.border`, `.border-error`, …)
//  tenian la MISMA especificidad, (0,1,0). Con empate manda el orden del
//  archivo, y el reset va DESPUES —Tailwind se emite en `demo.css:15-17` y el
//  reset esta en la 71, mismo archivo— asi que ganaba el reset y la utilidad no
//  pintaba nada. Envolviendo el ancla en `:where()` la especificidad del reset
//  baja a (0,0,0) y entonces CUALQUIER utilidad le gana, este donde este.
//
//  Esta prueba mide esa especificidad sobre el archivo real. Es una afirmacion
//  sobre la cascada, que es una regla aritmetica y no una opinion.
//
//  LO QUE NO AFIRMA: nada sobre pixeles. No hay navegador en este arnes, asi
//  que aqui no se prueba que una pantalla se vea bien — solo que la regla del
//  reset dejo de tener con que ganarle a una utilidad.
// ============================================================================

const CSS = readFileSync(join(__dirname, '..', '..', '..', 'app', '(app)', 'demo.css'), 'utf8')

/**
 * Especificidad (a, b, c) = (ids, clases/atributos/pseudo-clases, elementos).
 * Lo de dentro de `:where()` no cuenta — es justo lo que se esta usando.
 */
export function especificidad(selector: string): [number, number, number] {
  // Los caracteres escapados (`.hover\:border-accent`) son parte del NOMBRE de
  // la clase, no separadores: sin quitarlos, ese `\:` se cuenta como una
  // pseudo-clase de mas.
  const sinEscapes = selector.replace(/\\./g, 'x')
  const sinWhere = sinEscapes.replace(/:where\([^()]*\)/g, ' ')
  const ids = sinWhere.match(/#[\w-]+/g) ?? []
  const clases = sinWhere.match(/\.[\w-]+/g) ?? []
  const atributos = sinWhere.match(/\[[^\]]*\]/g) ?? []
  const pseudoClases = sinWhere.match(/(?<!:):(?!:)[\w-]+/g) ?? []
  const pseudoElementos = sinWhere.match(/::[\w-]+/g) ?? []
  const elementos = sinWhere.match(/(^|[\s>+~])([a-z][\w-]*)/g) ?? []
  return [
    ids.length,
    clases.length + atributos.length + pseudoClases.length,
    elementos.length + pseudoElementos.length,
  ]
}

const gana = (a: [number, number, number], b: [number, number, number]) =>
  a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] > b[2]

// Los selectores del bloque de reset, leidos del archivo y no escritos a mano:
// si alguien lo reescribe, esta prueba lee lo nuevo.
function selectoresDelReset(): string[] {
  const i = CSS.indexOf('box-sizing: border-box')
  expect(i, 'no se encontro el bloque de reset en demo.css').toBeGreaterThan(-1)
  const abre = CSS.lastIndexOf('{', i)
  const cuerpo = CSS.slice(abre, CSS.indexOf('}', i))
  expect(cuerpo).toContain('border-color')
  expect(cuerpo).toContain('border-width')
  const cabecera = CSS.slice(0, abre)
  const finLlave = cabecera.lastIndexOf('}') + 1
  const finComentario = cabecera.lastIndexOf('*/') + 2
  const ultimaRegla = cabecera.slice(Math.max(finLlave, finComentario))
  return ultimaRegla.split(',').map((s) => s.trim()).filter(Boolean)
}

describe('0 · la calculadora de especificidad', () => {
  it('cuenta lo que dice la especificacion', () => {
    expect(especificidad('.border')).toEqual([0, 1, 0])
    expect(especificidad('.demo-root *')).toEqual([0, 1, 0])
    expect(especificidad(':where(.demo-root) *')).toEqual([0, 0, 0])
    expect(especificidad('.hover\\:border-accent:hover')).toEqual([0, 2, 0])
    expect(especificidad('.demo-root input:not(:focus)')[2]).toBeGreaterThan(0)
  })
})

describe('1 · el reset ya no le gana a una utilidad de borde', () => {
  const UTILIDADES: [number, number, number] = [0, 1, 0] // `.border`, `.border-error`, …

  it('el bloque sigue existiendo y sigue reseteando el borde', () => {
    const sel = selectoresDelReset()
    expect(sel.length).toBeGreaterThanOrEqual(3) // *, ::before, ::after
  })

  it('ninguno de sus selectores le gana a una utilidad de Tailwind', () => {
    for (const sel of selectoresDelReset()) {
      const esp = especificidad(sel)
      expect(
        gana(esp, UTILIDADES),
        `"${sel}" tiene especificidad ${JSON.stringify(esp)} y le gana a una utilidad (0,1,0): ` +
          'el borde que pida una pantalla no se pintaria',
      ).toBe(false)
    }
  })

  it('el ancla .demo-root va dentro de :where(), que es lo que baja el peso', () => {
    // Sigue teniendo que estar ACOTADO a la demo: sin el ancla, el reset se
    // escaparia a la app de produccion, que no usa Tailwind.
    for (const sel of selectoresDelReset()) {
      expect(sel).toContain(':where(.demo-root)')
      expect(especificidad(sel)[1]).toBe(0)
    }
  })
})
