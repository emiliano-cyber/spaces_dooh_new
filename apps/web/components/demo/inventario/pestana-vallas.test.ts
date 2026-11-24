import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProveedorIdioma } from '@/lib/i18n/contexto'
import type { Idioma } from '@/lib/i18n/idiomas'
import type { Sitio } from '@/lib/data/client'
import { PestanasMedio, claseMedio } from './ResumenInventario'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/inventario',
}))

// ============================================================================
//  Vallas en Inventario · CAMBIO del 24/11.
// ----------------------------------------------------------------------------
//  El 20/11 la pestaña Vallas de Inventario abría la pantalla del módulo
//  entera (alta, grupos, plano). El 24/11 el dueño lo corrigió: «del
//  inventario se tiene que ver como el resto, como las fijas y las digitales;
//  en su propio módulo es donde se tiene que ver detallado». Así que Vallas es
//  una pestaña de MEDIO más: filtra la tabla a los sitios tipo VALLA, con su
//  cuenta, y el detalle vive en Comercial → Vallas.
// ============================================================================

const pintar = (props: Parameters<typeof PestanasMedio>[0], idioma: Idioma = 'es') =>
  renderToStaticMarkup(createElement(ProveedorIdioma, { idioma }, createElement(PestanasMedio, props)))

const pestanas = (html: string) =>
  [...html.matchAll(/<button[^>]*role="tab"[^>]*aria-selected="(true|false)"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => ({
    marcada: m[1] === 'true',
    texto: m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  }))

const sitio = (id: string, tipoMedio: string, extra: Partial<Sitio> = {}) =>
  ({ id, nombre: id, tipoMedio, esRotativo: false, exhibicion: 'fija', ...extra }) as unknown as Sitio

describe('pestaña Vallas en Inventario', () => {
  it('Todos · Fijos · Digitales · Vallas, cada una con su cuenta', () => {
    const sitios = [sitio('a', 'VALLA'), sitio('b', 'VALLA'), sitio('c', 'ESPECTACULAR'), sitio('d', 'PANTALLA_DIGITAL', { exhibicion: 'digital' } as Partial<Sitio>)]
    const p = pestanas(pintar({ sitios, medio: null, onCambio: () => {} }))
    expect(p.map((x) => x.texto)).toEqual(['Todos 4', 'Fijos 1', 'Digitales 1', 'Vallas 2'])
  })

  it('un sitio VALLA cuenta como valla, no como fijo', () => {
    expect(claseMedio(sitio('a', 'VALLA'))).toBe('valla')
    expect(claseMedio(sitio('b', 'ESPECTACULAR'))).toBe('fija')
  })

  it('elegida, es la marcada como cualquier otra pestaña de medio', () => {
    const p = pestanas(pintar({ sitios: [], medio: 'valla', onCambio: () => {} }))
    expect(p.filter((x) => x.marcada).map((x) => x.texto)).toEqual(['Vallas 0'])
  })

  it('ya no lleva «En proceso»: es una lista del inventario, no el módulo', () => {
    const html = pintar({ sitios: [], medio: null, onCambio: () => {} })
    expect(html).not.toContain('En proceso')
  })

  it('en inglés se traduce con la clave del menú', () => {
    const p = pestanas(pintar({ sitios: [], medio: null, onCambio: () => {} }, 'en'))
    expect(p[3].texto).toBe('Poster panels 0')
  })
})
