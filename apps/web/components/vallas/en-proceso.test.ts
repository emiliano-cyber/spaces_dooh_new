import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProveedorIdioma } from '@/lib/i18n/contexto'
import type { Idioma } from '@/lib/i18n/idiomas'
import { NAV } from '@/components/demo/shell/nav'

// ============================================================================
//  VALLAS «EN PROCESO» (pedido del dueño, 19/11).
// ----------------------------------------------------------------------------
//  El módulo sale a todas las instancias como esqueleto, y quien lo abra tiene
//  que saber que todavía se está construyendo: una etiqueta junto a «Vallas»
//  en el menú y un aviso en la cabecera de la pantalla, en los cuatro idiomas.
//
//  Se rinde el componente REAL (patrón de `lib/i18n/pantallas.test.ts`): una
//  clave puesta en el diccionario que nadie pinta pasaría una prueba de datos
//  y no ésta.
// ============================================================================

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/vallas',
}))

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
})

const INSIGNIA: Record<Idioma, string> = {
  es: 'En proceso',
  en: 'In progress',
  it: 'In corso',
  pt: 'Em andamento',
}

const AVISO: Record<Idioma, string> = {
  es: 'Este módulo todavía se está construyendo; las reglas y la numeración pueden cambiar.',
  en: 'This module is still being built; the rules and the numbering may change.',
  it: 'Questo modulo è ancora in costruzione; le regole e la numerazione possono cambiare.',
  pt: 'Este módulo ainda está sendo construído; as regras e a numeração podem mudar.',
}

const IDIOMAS: Idioma[] = ['es', 'en', 'it', 'pt']

async function pintarSidebar(idioma: Idioma): Promise<string> {
  const { Sidebar } = await import('@/components/demo/shell/Sidebar')
  const { MenuMovilProvider } = await import('@/components/demo/shell/MenuMovilContext')
  return renderToStaticMarkup(
    createElement(ProveedorIdioma, { idioma }, createElement(MenuMovilProvider, null, createElement(Sidebar))),
  )
}

async function pintarVallas(idioma: Idioma): Promise<string> {
  const { VallasPantalla } = await import('./Vallas')
  return renderToStaticMarkup(createElement(ProveedorIdioma, { idioma }, createElement(VallasPantalla)))
}

// El <li> del menú que lleva a /vallas (y solo ése).
function entradaDe(html: string, href: string): string {
  const i = html.indexOf(`href="${href}"`)
  expect(i, `no hay enlace a ${href}`).toBeGreaterThan(-1)
  const ini = html.lastIndexOf('<li', i)
  const fin = html.indexOf('</li>', i)
  return html.slice(ini, fin)
}

const escapar = (s: string) => s.replace(/'/g, '&#x27;')

describe('la insignia del menú es genérica, y hoy solo la lleva Vallas', () => {
  it('Vallas va marcada «en proceso»', () => {
    expect(NAV.find((n) => n.key === 'vallas')!.insignia).toBe('en-proceso')
  })

  it('ninguna otra entrada la lleva', () => {
    expect(NAV.filter((n) => n.insignia).map((n) => n.key)).toEqual(['vallas'])
  })
})

describe.each(IDIOMAS)('Vallas «en proceso» en %s', (idioma) => {
  it('el menú pinta la insignia junto a Vallas', async () => {
    const html = await pintarSidebar(idioma)
    expect(entradaDe(html, '/vallas')).toContain(INSIGNIA[idioma])
  })

  it('y SOLO junto a Vallas: Inventario no la lleva', async () => {
    const html = await pintarSidebar(idioma)
    expect(entradaDe(html, '/inventario')).not.toContain(INSIGNIA[idioma])
    // Tantas como enlaces a /vallas: con su sección plegada, la entrada actual
    // se pinta dos veces (la oculta del cuerpo y la que queda a la vista).
    const cuenta = (aguja: string) => html.split(aguja).length - 1
    expect(cuenta(`>${INSIGNIA[idioma]}<`)).toBe(cuenta('href="/vallas"'))
  })

  it('la cabecera de la pantalla avisa que el módulo se está construyendo', async () => {
    const html = await pintarVallas(idioma)
    expect(html).toContain(INSIGNIA[idioma])
    expect(html).toContain(escapar(AVISO[idioma]))
    // Va ANTES de la primera tarjeta: es lo primero que se lee.
    expect(html.indexOf(escapar(AVISO[idioma]))).toBeLessThan(html.indexOf('<h3'))
  })
})
