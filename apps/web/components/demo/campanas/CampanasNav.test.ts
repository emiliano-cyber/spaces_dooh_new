import { describe, it, expect, vi } from 'vitest'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// ============================================================================
//  El menú lateral de campañas se puede plegar — en CUALQUIER ancho.
// ----------------------------------------------------------------------------
//  Pedido del dueño el 2026-09-30. Antes el menú no tenía botón: en móvil y
//  tableta se apilaba ENCIMA del pipeline ocupando hasta el 60 % de la altura,
//  y en escritorio se comía 16rem de ancho fijo.
//
//  Se RINDE la vista de verdad con `react-dom/server` (sin jsdom, igual que
//  `ui/Button.test.ts`) y se lee el HTML. Lo que eso NO alcanza —el clic, el
//  efecto que lee localStorage— no se finge aquí: el clic cambia un booleano y
//  la lectura validada se prueba en `lib/campanas-menu.test.ts`.
// ============================================================================

// La vista no toca el store, pero el módulo sí lo importa para el envoltorio.
vi.mock('@/lib/data/client', () => ({ useCampanas: () => undefined }))

const CAMPANAS = [
  { id: 'c1', nombre: 'Verano', folio: 'CMP-001', estadoComercial: 'ACTIVA', creadoEn: '2026-09-01' },
  { id: 'c2', nombre: 'Otoño', folio: 'CMP-002', estadoComercial: 'ACTIVA', creadoEn: '2026-09-10' },
] as const

async function rendir(plegado: boolean): Promise<string> {
  const { CampanasNavVista } = await import('./CampanasNav')
  return renderToStaticMarkup(
    React.createElement(CampanasNavVista, {
      campanas: CAMPANAS as never,
      activeId: 'c1',
      plegado,
      onAlternar: () => {},
    }),
  )
}

function boton(html: string): string {
  const m = html.match(/<button[^>]*>/)
  if (!m) throw new Error('el menú salió sin botón para plegarse: ' + html)
  return m[0]
}

describe('1 · hay un botón para plegar, y dice lo que hace', () => {
  it('desplegado: aria-expanded="true" y la etiqueta en español invita a ocultar', async () => {
    const b = boton(await rendir(false))
    expect(b).toContain('aria-expanded="true"')
    expect(b).toMatch(/aria-label="Ocultar el menú de campañas"/)
  })

  it('plegado: aria-expanded="false" y la etiqueta invita a mostrar', async () => {
    const b = boton(await rendir(true))
    expect(b).toContain('aria-expanded="false"')
    expect(b).toMatch(/aria-label="Mostrar el menú de campañas"/)
  })

  it('aria-controls apunta a la lista que de verdad se pliega', async () => {
    const html = await rendir(false)
    const id = boton(html).match(/aria-controls="([^"]+)"/)?.[1]
    expect(id, 'el botón no dice qué controla').toBeTruthy()
    expect(html).toMatch(new RegExp(`<nav[^>]*id="${id}"`))
  })

  it('el botón no tiene clases que lo escondan en ningún ancho', async () => {
    for (const plegado of [false, true]) {
      const b = boton(await rendir(plegado))
      expect(b, `con plegado=${plegado}`).not.toMatch(/(^|\s|")(\w+:)?hidden(\s|")/)
    }
  })
})

describe('2 · plegar esconde la lista y libera el ancho', () => {
  it('desplegado: la lista se ve con las dos campañas, la activa marcada', async () => {
    const html = await rendir(false)
    const nav = html.match(/<nav[^>]*>/)![0]
    expect(nav).not.toContain('hidden')
    expect(html).toContain('href="/campanas/c1"')
    expect(html).toContain('href="/campanas/c2"')
    expect(html).toMatch(/aria-current="page"[^>]*href="\/campanas\/c1"|href="\/campanas\/c1"[^>]*aria-current="page"/)
  })

  it('plegado: la lista lleva `hidden` — sigue en el DOM para aria-controls, pero no se ve', async () => {
    const html = await rendir(true)
    expect(html.match(/<nav[^>]*>/)![0]).toMatch(/\shidden(=""|\s|>)/)
  })

  it('plegado: el aside deja de reservar los 16rem de escritorio', async () => {
    const abierto = (await rendir(false)).match(/<aside[^>]*class="([^"]*)"/)![1]
    const plegado = (await rendir(true)).match(/<aside[^>]*class="([^"]*)"/)![1]
    expect(abierto).toContain('lg:w-64')
    expect(plegado).not.toContain('lg:w-64')
  })
})
