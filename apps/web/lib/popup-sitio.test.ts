import { describe, it, expect } from 'vitest'
import { htmlPopupSitio } from './popup-sitio'

// ============================================================================
//  SEG-21OCT · A6 — el popup del mapa de sitios escapa lo que pinta.
// ----------------------------------------------------------------------------
//  Auditoría del 2026-10-21. `SitiosMap.tsx` metía `nombre`, `claveInterna` y
//  `tipoMedio` del sitio tal cual dentro de `Popup.setHTML(...)`. Son textos que
//  captura cualquiera con permiso de inventario —o que llegan de un Excel
//  importado—, y el popup se abre en la pantalla de quien mire el mapa.
//
//  Lo único que estaba en medio era el saneador de MapLibre, y MapLibre 5.24
//  arrastra GHSA-jrc7-96c5-q579 (crítico): ese saneador se puede esquivar. Con
//  la CSP en `'unsafe-inline'`, un `<img src=x onerror=…>` como nombre de sitio
//  corría con la sesión de quien pasara el ratón por el punto.
//
//  La corrección no depende del saneador: el texto se escapa ANTES, así que a
//  `setHTML` solo le llega marcado nuestro.
// ============================================================================

describe('A6 · lo que el popup NO deja pasar como HTML', () => {
  it('un <img onerror> en el nombre sale como texto', () => {
    const html = htmlPopupSitio({
      nombre: '<img src=x onerror="alert(document.domain)">',
      claveInterna: 'K-1',
      tipoMedio: 'Espectacular',
    })
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(document.domain)&quot;&gt;')
  })

  it('un <script> en la clave interna sale como texto', () => {
    const html = htmlPopupSitio({ nombre: 'Sitio', claveInterna: '<script>alert(1)</script>', tipoMedio: 'X' })
    expect(html).not.toContain('<script')
    expect(html).toContain('&lt;script&gt;')
  })

  it('el tipo de medio tampoco se cuela', () => {
    const html = htmlPopupSitio({ nombre: 'S', claveInterna: 'K', tipoMedio: '"><svg onload=alert(1)>' })
    expect(html).not.toContain('<svg')
  })

  it('las comillas simples y el & también se escapan', () => {
    const html = htmlPopupSitio({ nombre: "O'Higgins & Juárez", claveInterna: 'K', tipoMedio: 'X' })
    expect(html).toContain('O&#39;Higgins &amp; Juárez')
  })
})

describe('A6 · lo que el popup sigue mostrando', () => {
  it('los tres datos, con su texto normal', () => {
    const html = htmlPopupSitio({ nombre: 'Periférico Sur 4500', claveInterna: 'CDMX-014', tipoMedio: 'Pantalla digital' })
    expect(html).toContain('Periférico Sur 4500')
    expect(html).toContain('CDMX-014 · Pantalla digital')
  })

  it('un dato vacío no rompe el popup', () => {
    const html = htmlPopupSitio({ nombre: 'S', claveInterna: null, tipoMedio: undefined })
    expect(html).toContain('S')
    expect(html).not.toContain('null')
    expect(html).not.toContain('undefined')
  })
})
