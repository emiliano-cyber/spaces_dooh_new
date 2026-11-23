import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProveedorIdioma } from '@/lib/i18n/contexto'
import type { Idioma } from '@/lib/i18n/idiomas'
import { PestanasMedio } from './ResumenInventario'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/inventario',
}))

// ============================================================================
//  Vallas también dentro de Inventario (pedido del dueño, 20/11).
// ----------------------------------------------------------------------------
//  El menú lleva Vallas UNA sola vez, en Comercial. En la pantalla Inventario
//  el dueño quiere la misma opción como pestaña, junto a Todos · Fijos ·
//  Digitales, con su etiqueta «En proceso». Al elegirla se ve la pantalla de
//  Vallas (alta, grupos, plano y «Verificar una marca»).
//
//  Lo que se fija aquí es lo que puede romperse en silencio:
//   · la pestaña solo sale si quien la pinta la ofrece (otras pantallas que
//     usen las pestañas de medio no la heredan);
//   · con Vallas elegida, ninguna pestaña de medio queda marcada a la vez.
// ============================================================================

const pintar = (props: Parameters<typeof PestanasMedio>[0], idioma: Idioma = 'es') =>
  renderToStaticMarkup(createElement(ProveedorIdioma, { idioma }, createElement(PestanasMedio, props)))

const pestanas = (html: string) =>
  [...html.matchAll(/<button[^>]*role="tab"[^>]*aria-selected="(true|false)"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => ({
    marcada: m[1] === 'true',
    texto: m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  }))

describe('pestaña Vallas en Inventario', () => {
  it('sin ofrecerla, solo están Todos · Fijos · Digitales', () => {
    const html = pintar({ sitios: [], medio: null, onCambio: () => {} })
    expect(pestanas(html).map((p) => p.texto.split(' ')[0])).toEqual(['Todos', 'Fijos', 'Digitales'])
  })

  it('ofrecida, sale al final con «En proceso», sin marcar', () => {
    const html = pintar({ sitios: [], medio: null, onCambio: () => {}, vallas: { activa: false, onElegir: () => {} } })
    const p = pestanas(html)
    expect(p).toHaveLength(4)
    expect(p[3].texto).toBe('Vallas En proceso')
    expect(p[3].marcada).toBe(false)
    expect(p[0].marcada).toBe(true)
  })

  it('elegida, es la ÚNICA marcada aunque el filtro de medio diga otra cosa', () => {
    const html = pintar({ sitios: [], medio: 'fija', onCambio: () => {}, vallas: { activa: true, onElegir: () => {} } })
    expect(pestanas(html).filter((p) => p.marcada).map((p) => p.texto)).toEqual(['Vallas En proceso'])
  })

  it('en inglés se traduce con las claves del menú', () => {
    const html = pintar({ sitios: [], medio: null, onCambio: () => {}, vallas: { activa: false, onElegir: () => {} } }, 'en')
    expect(pestanas(html)[3].texto).toBe('Poster panels In progress')
  })
})
