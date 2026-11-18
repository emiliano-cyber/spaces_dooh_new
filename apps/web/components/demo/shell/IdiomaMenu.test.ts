import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ProveedorIdioma } from '@/lib/i18n/contexto'
import type { Idioma } from '@/lib/i18n/idiomas'
import { IdiomaMenu } from './IdiomaMenu'
import { guardarIdiomaDeCuenta } from '@/components/demo/admin/IdiomaCuenta'

// 06/11 · el idioma a un clic en el menú de la cuenta. Lo que importa:
//  · con un solo idioma encendido (hoy, toda la flota) el menú queda IDÉNTICO;
//  · con varios, ofrece SOLO los encendidos, cada uno nombrado en sí mismo;
//  · y guarda en la CUENTA (`PUT /api/perfil/idioma`), no solo en la cookie.

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function pintar(idioma: Idioma, disponibles?: Idioma[]) {
  // El menú abierto y sin Portal: así el contenido sale en el HTML estático.
  return renderToStaticMarkup(
    createElement(
      ProveedorIdioma,
      { idioma, puedeElegir: !!disponibles && disponibles.length > 1, disponibles },
      createElement(
        DropdownMenu.Root,
        { open: true },
        createElement(DropdownMenu.Trigger, null, 'cuenta'),
        createElement(DropdownMenu.Content, null, createElement(IdiomaMenu)),
      ),
    ),
  )
}

describe('IdiomaMenu', () => {
  it('NEGATIVO · con SOLO el español encendido no pinta nada (ni la raya)', () => {
    const solo = pintar('es', ['es'])
    expect(solo).not.toContain('menuitemradio')
    expect(solo).not.toContain('h-px')
    expect(pintar('es')).not.toContain('menuitemradio')
  })

  it('con varios, uno por idioma encendido, nombrado en sí mismo', () => {
    const html = pintar('es', ['es', 'en', 'pt'])
    expect(html.match(/role="menuitemradio"/g)).toHaveLength(3)
    expect(html).toContain('Español')
    expect(html).toContain('English')
    expect(html).toContain('Português')
  })

  it('NEGATIVO · un idioma apagado no aparece', () => {
    const html = pintar('es', ['es', 'en'])
    expect(html).not.toContain('Italiano')
    expect(html).not.toContain('Português')
  })

  it('marca el vigente, y solo ese', () => {
    const html = pintar('en', ['es', 'en', 'it'])
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1)
    expect(html).toMatch(/aria-checked="true"[^>]*>(?:(?!role="menuitemradio").)*English/)
  })

  it('el rótulo del bloque, en el idioma vigente', () => {
    expect(pintar('es', ['es', 'en'])).toContain('Idioma')
    expect(pintar('en', ['es', 'en'])).toContain('Language')
  })
})

describe('guardarIdiomaDeCuenta · guarda EN LA CUENTA', () => {
  it('PUT a /perfil/idioma con el idioma elegido', async () => {
    const pedir = vi.fn(async () => new Response('{}', { status: 200 }))
    await guardarIdiomaDeCuenta('pt', 'respaldo', pedir as unknown as typeof fetch)
    expect(pedir).toHaveBeenCalledTimes(1)
    const [url, init] = pedir.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/spaces-dooh/api/perfil/idioma/')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(String(init.body))).toEqual({ idioma: 'pt' })
  })

  it('NEGATIVO · si el servidor lo rechaza, lanza SU mensaje', async () => {
    const pedir = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'Ese idioma no está disponible en este servidor.' }), { status: 400 }),
    )
    await expect(guardarIdiomaDeCuenta('it', 'respaldo', pedir as unknown as typeof fetch)).rejects.toThrow(
      'Ese idioma no está disponible en este servidor.',
    )
  })

  it('NEGATIVO · sin mensaje del servidor, lanza el de respaldo', async () => {
    const pedir = vi.fn(async () => new Response('no es json', { status: 500 }))
    await expect(guardarIdiomaDeCuenta('en', 'respaldo', pedir as unknown as typeof fetch)).rejects.toThrow('respaldo')
  })
})

describe('Topbar · el menú de la cuenta lleva el selector', () => {
  it('monta <IdiomaMenu /> dentro del menú de la cuenta', () => {
    const fuente = readFileSync(join(__dirname, 'Topbar.tsx'), 'utf8')
    const menuCuenta = fuente.slice(fuente.indexOf("t('shell.topbar.codigos')"), fuente.indexOf("t('shell.topbar.cerrar-sesion')"))
    expect(menuCuenta).toContain('<IdiomaMenu />')
  })
})
