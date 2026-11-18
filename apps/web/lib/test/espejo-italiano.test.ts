import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProveedorIdioma, useIdioma } from '@/lib/i18n/contexto'
import { formatFecha } from '@/lib/data/derive'
import { espejoItaliano } from './espejo-italiano'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

function Importe() {
  const { dinero } = useIdioma()
  return createElement('b', null, dinero(1160))
}
function Fecha({ idioma }: { idioma: 'es' | 'en' | 'it' }) {
  return createElement('i', null, formatFecha('2026-12-01', idioma))
}

describe('espejoItaliano', () => {
  it('rinde en italiano un arbol ingles, tambien la propiedad `idioma` de los hijos', () => {
    const el = createElement(
      ProveedorIdioma,
      { idioma: 'en', puedeElegir: true },
      createElement(Importe),
      createElement(Fecha, { idioma: 'en' }),
    )
    const r = espejoItaliano(el, renderToStaticMarkup)!
    expect(r.html).toBe('<b>MX$ 1.160,00</b><i>1 dic 2026</i>')
    expect(r.hallazgos).toEqual([])
  })

  it('apunta lo que se quedo con formato ajeno', () => {
    const el = createElement(ProveedorIdioma, { idioma: 'en' }, createElement('p', null, 'Dec 1, 2026'))
    expect(espejoItaliano(el, renderToStaticMarkup)!.hallazgos[0]).toMatch(/^fecha en ingles/)
  })

  it('el espanol y lo que no es un proveedor no se espejan', () => {
    expect(espejoItaliano(createElement(ProveedorIdioma, { idioma: 'es' }), renderToStaticMarkup)).toBeNull()
    expect(espejoItaliano(createElement('p'), renderToStaticMarkup)).toBeNull()
  })
})
