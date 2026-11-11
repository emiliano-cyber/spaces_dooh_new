import { describe, it, expect } from 'vitest'
import { parseTrail, withTrail } from './nav-trail'

// ============================================================================
//  SEG-21OCT · A5 — el rastro `?from=` solo acepta rutas INTERNAS.
// ----------------------------------------------------------------------------
//  Auditoría del 2026-10-21. `parseTrail` comprobaba que `label` fuera texto y
//  dejaba pasar cualquier `href`. Ese `href` se pinta como `<Link>` en «Volver»
//  (campañas, propuestas, OT y las migas). Con un enlace como
//
//    /campanas/<id>/?from=[{"label":"Volver","href":"javascript:alert(1)"}]
//
//  el clic ejecutaba código con la sesión de quien lo abría, y con
//  `"href":"https://otro.sitio"` servía para mandarlo fuera haciéndose pasar
//  por un botón de la aplicación.
//
//  Toda miga legítima la construye la propia aplicación con una ruta que
//  empieza por `/` (`withTrail(..., [{ label: 'Operaciones', href: '/operaciones' }])`),
//  así que la regla no le quita nada a nadie: un paso con otro `href` se
//  descarta entero.
// ============================================================================

const rastro = (crumbs: unknown) => encodeURIComponent(JSON.stringify(crumbs))

describe('A5 · lo que el rastro descarta', () => {
  it.each([
    ['javascript:', 'javascript:alert(document.domain)'],
    ['JavaScript: en mayúsculas', 'JavaScript:alert(1)'],
    ['javascript: con espacios delante', '  javascript:alert(1)'],
    ['data:', 'data:text/html,<script>alert(1)</script>'],
    ['una URL absoluta', 'https://evil.example/login'],
    ['una URL sin esquema (//host)', '//evil.example/login'],
    ['la barra invertida, que el navegador lee como //', '/\\evil.example'],
    ['una ruta relativa', 'operaciones'],
  ])('descarta un paso con %s', (_n, href) => {
    expect(parseTrail(rastro([{ label: 'Volver', href }]))).toEqual([])
  })

  it('descarta solo el paso malo y conserva los buenos', () => {
    const r = parseTrail(
      rastro([
        { label: 'Campañas', href: '/campanas' },
        { label: 'Trampa', href: 'javascript:alert(1)' },
        { label: 'OT', href: '/operaciones/ot/7' },
      ]),
    )
    expect(r.map((c) => c.label)).toEqual(['Campañas', 'OT'])
  })

  it('descarta un href que no sea texto', () => {
    expect(parseTrail(rastro([{ label: 'Volver', href: { toString: 'x' } }]))).toEqual([])
  })
})

describe('A5 · lo que el rastro sigue aceptando', () => {
  it('las rutas internas que arma la aplicación, ida y vuelta por withTrail', () => {
    const trail = [
      { label: 'Operaciones', href: '/operaciones' },
      { label: 'Campaña', href: '/campanas/abc?tab=ot' },
    ]
    const href = withTrail('/operaciones/ot/9', trail)
    const from = new URL(href, 'http://x').searchParams.get('from')
    expect(parseTrail(from)).toEqual(trail)
  })

  it('una miga sin href (la última del rastro no lleva enlace)', () => {
    expect(parseTrail(rastro([{ label: 'Aquí' }]))).toEqual([{ label: 'Aquí' }])
  })
})
