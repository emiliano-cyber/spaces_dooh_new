import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { especificidad } from './reset-bordes.test'

// ============================================================================
//  OBLIG-01 · el borde rojo del campo que falta tiene que GANAR la cascada.
//
//  Visto en el navegador el 20/10: la etiqueta se ponía roja y salía «Falta
//  este dato», pero el borde del control seguía gris. La regla vivía en
//  `globals.css` con especificidad (0,1,1), y `demo.css` recolorea todo
//  control con `.demo-root textarea:not(:focus)`, que es (0,2,1): ganaba
//  siempre. Ninguna prueba lo veía, porque aquí no hay navegador.
//
//  Lo que se afirma, como en `reset-bordes.test.ts`: aritmética de cascada
//  sobre el archivo real. Empate de especificidad lo decide el orden, así que
//  la regla del rojo tiene que ir DESPUÉS del recoloreado.
// ============================================================================

const CSS = readFileSync(join(__dirname, '..', '..', '..', 'app', '(app)', 'demo.css'), 'utf8')

const RECOLOREADO = '.demo-root textarea:not(:focus)'
const ROJO = ".demo-root [data-falta] :is(input, select, textarea, [role='combobox'])"

describe('el rojo del obligatorio que falta le gana al recoloreado de controles', () => {
  it('la regla del rojo está en demo.css', () => {
    expect(CSS.includes(ROJO)).toBe(true)
  })

  it('no pierde por especificidad', () => {
    const [a1, b1, c1] = especificidad(ROJO.replace(/:is\(([^()]*)\)/, 'textarea'))
    const [a2, b2, c2] = especificidad(RECOLOREADO.replace(':not(:focus)', ''))
    // El `:not(:focus)` del recoloreado suma lo de dentro: una pseudo-clase.
    const recoloreado: [number, number, number] = [a2, b2 + 1, c2]
    const rojo: [number, number, number] = [a1, b1, c1]
    expect(rojo[0] > recoloreado[0] || (rojo[0] === recoloreado[0] && rojo[1] >= recoloreado[1])).toBe(true)
  })

  it('y va DESPUÉS, para ganar el empate', () => {
    expect(CSS.indexOf(ROJO)).toBeGreaterThan(CSS.indexOf(RECOLOREADO))
  })
})
