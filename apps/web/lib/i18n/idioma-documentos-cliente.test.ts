import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// ============================================================================
//  ADR 0049 (segunda vuelta, 03/11) · «todo debe salir en el idioma que se
//  configuro el programa». Los PAPELES se pintan en el idioma de los
//  documentos de la instancia, aunque la persona mire la aplicacion en otro.
//  `EnIdiomaDeLosDocumentos` re-provee el idioma para lo que envuelve.
// ============================================================================

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }))

const { ProveedorIdioma, useIdioma } = await import('./contexto')
const { ProveedorIdiomaDocumentos, EnIdiomaDeLosDocumentos, useIdiomaDocumentos } = await import(
  './idioma-documentos-cliente'
)

function Sonda() {
  const { idioma, t, puedeElegir } = useIdioma()
  return h('p', null, `${idioma}|${t('propuestas.documento.importe')}|${puedeElegir}`)
}
function SondaDoc() {
  return h('p', null, useIdiomaDocumentos() ?? 'ninguno')
}

const pinta = (el: ReturnType<typeof h>) => renderToStaticMarkup(el)

describe('EnIdiomaDeLosDocumentos', () => {
  it('la persona mira en ingles, la instancia es espanola: el papel sale en ESPANOL', () => {
    const html = pinta(
      h(ProveedorIdiomaDocumentos, { idioma: 'es' },
        h(ProveedorIdioma, { idioma: 'en', puedeElegir: true },
          h(EnIdiomaDeLosDocumentos, null, h(Sonda)))),
    )
    expect(html).toContain('es|')
    // Y dentro del papel no se ofrece elegir idioma: no es de quien lo mira.
    expect(html).toContain('|false')
  })

  it('instancia italiana, persona en espanol: italiano', () => {
    const html = pinta(
      h(ProveedorIdiomaDocumentos, { idioma: 'it' },
        h(ProveedorIdioma, { idioma: 'es' }, h(EnIdiomaDeLosDocumentos, null, h(Sonda)))),
    )
    expect(html).toMatch(/<p>it\|/)
  })

  it('lo de FUERA del papel sigue el idioma de la persona', () => {
    const html = pinta(
      h(ProveedorIdiomaDocumentos, { idioma: 'es' },
        h(ProveedorIdioma, { idioma: 'en' }, h(Sonda), h(EnIdiomaDeLosDocumentos, null, h(Sonda)))),
    )
    expect(html).toMatch(/^<p>en\|.*<p>es\|/)
  })

  it('sin proveedor de la instancia (una prueba suelta) no impone nada: sigue la persona', () => {
    const html = pinta(h(ProveedorIdioma, { idioma: 'en' }, h(EnIdiomaDeLosDocumentos, null, h(Sonda))))
    expect(html).toContain('<p>en|')
    expect(pinta(h(SondaDoc))).toContain('ninguno')
  })
})
