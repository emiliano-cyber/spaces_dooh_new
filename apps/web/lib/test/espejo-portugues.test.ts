import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProveedorIdioma, useIdioma } from '@/lib/i18n/contexto'
import { formatFecha } from '@/lib/data/derive'
import { espejoPortugues } from './espejo-portugues'

// Ola 0 del portugues (2026-11-05) · el espejo pt-BR de las pruebas de
// pantallas (`I18N_VOLCAR_PT`), hermano del italiano.

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

function Importe() {
  const { dinero, t } = useIdioma()
  return createElement('b', null, `${t('comun.cancelar')} ${dinero(1160)}`)
}
function Fecha({ idioma }: { idioma: 'es' | 'en' | 'it' | 'pt' }) {
  return createElement('i', null, formatFecha('2026-12-01', idioma))
}

describe('espejoPortugues', () => {
  it('rinde en portugues un arbol ingles, tambien la propiedad `idioma` de los hijos; el texto cae al espanol', () => {
    const el = createElement(
      ProveedorIdioma,
      { idioma: 'en', puedeElegir: true },
      createElement(Importe),
      createElement(Fecha, { idioma: 'en' }),
    )
    const r = espejoPortugues(el, renderToStaticMarkup)!
    expect(r.html).toBe('<b>Cancelar MX$ 1.160,00</b><i>1 de dez. de 2026</i>')
    expect(r.hallazgos).toEqual([])
  })

  it('apunta lo que se quedo con formato ajeno', () => {
    const el = createElement(ProveedorIdioma, { idioma: 'en' }, createElement('p', null, 'Dec 1, 2026'))
    expect(espejoPortugues(el, renderToStaticMarkup)!.hallazgos[0]).toMatch(/^fecha en ingles/)
  })

  it('el espanol y lo que no es un proveedor no se espejan', () => {
    expect(espejoPortugues(createElement(ProveedorIdioma, { idioma: 'es' }), renderToStaticMarkup)).toBeNull()
    expect(espejoPortugues(createElement('p'), renderToStaticMarkup)).toBeNull()
  })
})
