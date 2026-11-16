import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  COLOR_POR_OMISION,
  PALETAS,
  colorLegible,
  contraste,
  cssDePaleta,
  leerPaleta,
  normalizarHex,
  tokensDeColor,
} from './apariencia'

describe('la paleta de la instancia se elige al instalar (PALETA-01)', () => {
  it('TODAS las paletas predefinidas son legibles con texto blanco (AA, 4.5:1)', () => {
    for (const p of PALETAS) expect(colorLegible(p.color), p.clave).toBe(true)
  })

  it('el contraste se mide como WCAG: negro contra blanco es 21, igual consigo mismo es 1', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contraste('#0a66ff', '#0a66ff')).toBeCloseTo(1, 5)
  })

  it('sin PALETA, o vacia, es el azul de siempre y NO es un error', () => {
    expect(leerPaleta(undefined)).toEqual({ ok: true, color: COLOR_POR_OMISION })
    expect(leerPaleta('')).toEqual({ ok: true, color: COLOR_POR_OMISION })
    expect(leerPaleta('   ')).toEqual({ ok: true, color: COLOR_POR_OMISION })
  })

  it('acepta las claves (sin importar mayusculas) y un color propio legible', () => {
    expect(leerPaleta('verde')).toEqual({ ok: true, color: '#12805c' })
    expect(leerPaleta('Vino')).toEqual({ ok: true, color: '#9f1239' })
    expect(leerPaleta('#1E3A8A')).toEqual({ ok: true, color: '#1e3a8a' })
  })

  it('un color ILEGIBLE cae al azul y dice por que: nunca botones invisibles', () => {
    for (const malo of ['#facc15', '#7dd3fc', '#ffffff']) {
      const r = leerPaleta(malo)
      expect(r.ok, malo).toBe(false)
      expect(r.color).toBe(COLOR_POR_OMISION)
      if (!r.ok) expect(r.motivo).toMatch(/contraste/)
    }
  })

  it('lo que no es paleta ni color cae al azul, y un intento de inyectar CSS no pasa', () => {
    for (const malo of ['rosa', 'red', '#12345', '#0a66ff;}body{display:none']) {
      const r = leerPaleta(malo)
      expect(r.ok, malo).toBe(false)
      expect(r.color).toBe(COLOR_POR_OMISION)
    }
    expect(cssDePaleta('#0a66ff;}body{display:none')).toBe('')
  })

  it('normaliza el color: mayusculas, sin #, forma corta', () => {
    expect(normalizarHex('#0A66FF')).toBe('#0a66ff')
    expect(normalizarHex('0a66ff')).toBe('#0a66ff')
    expect(normalizarHex('#abc')).toBe('#aabbcc')
    expect(normalizarHex(42)).toBeNull()
  })

  it('el azul de SPACE OS reproduce sus propios tonos de demo.css (hover y tinte)', () => {
    const k = tokensDeColor('#0a66ff')
    // demo.css: --accent-hover #0052d6, --accent-soft #eaf1ff, elegidos a mano.
    // La formula da #0856d6: se admite ±10 por canal, que a la vista es igual.
    const cerca = (a: string, b: string) =>
      [1, 3, 5].every((i) => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) <= 10)
    expect(cerca(k.accentHover, '#0052d6'), k.accentHover).toBe(true)
    expect(cerca(k.accentSoft, '#eaf1ff'), k.accentSoft).toBe(true)
  })

  it('la paleta de siempre NO emite CSS (una instancia sin tocar sirve el mismo HTML)', () => {
    expect(cssDePaleta(COLOR_POR_OMISION)).toBe('')
  })

  it('otra paleta sobrescribe las variables del color de producto y nada mas', () => {
    const css = cssDePaleta('#12805c')
    expect(css).toContain('--accent:#12805c')
    expect(css).toContain('--info:#12805c')
    expect(css).not.toMatch(/--bg|--ink|--success|--error/)
  })

  it('las paletas del alta (bash) son LAS MISMAS que las de la aplicacion', () => {
    // `entorno-instancia.sh` valida `--paleta` antes de escribir `app.env`.
    // Si una lista crece y la otra no, el alta aceptaria un nombre que la
    // aplicacion pinta de azul, o rechazaria uno valido.
    const sh = readFileSync(join(__dirname, '../../../infra/scripts/entorno-instancia.sh'), 'utf8')
    for (const p of PALETAS) expect(sh, p.clave).toContain(`${p.clave}) printf '%s' '${p.color}'`)
    expect(sh.match(/^\s+\w+\) printf '%s' '#[0-9a-f]{6}' ;;$/gm)?.length).toBe(PALETAS.length)
  })
})
