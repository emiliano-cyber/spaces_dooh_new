import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProveedorIdioma } from '@/lib/i18n/contexto'
import {
  IdiomasServidorPanel,
  elegidosAlCargar,
  elegidosAlCambiarServidor,
  listaAGuardar,
  puedeGuardarIdiomas,
} from './IdiomasServidorPanel'

// IDIOMAS-SIN-ES (18/11) · pedido del dueno: «el idioma predefinido es el del
// servidor, pero si lo cambia, las 4 opciones de abajo deben estar sin
// seleccionar para que el usuario elija el idioma». Y el espanol, «tambien sin
// marcar y elegible».

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

function pintar(inicial: { idiomas: ('es' | 'en' | 'it' | 'pt')[] | null; activos: ('es' | 'en' | 'it' | 'pt')[] }) {
  return renderToStaticMarkup(
    createElement(ProveedorIdioma, { idioma: 'es' }, createElement(IdiomasServidorPanel, { onToast: () => {}, inicial })),
  )
}

/** Las casillas de idioma (las 4 de abajo), en orden, con su estado. */
function casillas(html: string) {
  return [...html.matchAll(/<input type="checkbox"([^>]*)data-idioma="(\w+)"([^>]*)\/?>/g)].map((m) => ({
    idioma: m[2],
    marcada: /checked=""/.test(m[1] + m[3]),
    deshabilitada: /disabled=""/.test(m[1] + m[3]),
  }))
}

describe('IdiomasServidorPanel · la logica', () => {
  it('por omision manda el servidor: nada elegido a mano', () => {
    expect(elegidosAlCargar({ idiomas: null, activos: ['es', 'en'] })).toEqual([])
  })

  it('con idiomas YA guardados, se cargan marcados (no se borran al abrir)', () => {
    expect(elegidosAlCargar({ idiomas: ['en', 'pt'], activos: ['en', 'pt'] })).toEqual(['en', 'pt'])
  })

  it('al QUITAR «servidor», las 4 quedan sin marcar, aunque hubiera algo elegido', () => {
    expect(elegidosAlCambiarServidor(false, ['en', 'pt'])).toEqual([])
    expect(elegidosAlCambiarServidor(false, [])).toEqual([])
  })

  it('al volver a marcar «servidor», lo elegido no importa (se guarda null)', () => {
    expect(listaAGuardar(true, ['en'])).toBeNull()
  })

  it('la lista se guarda tal cual, sin anadir el espanol, en el orden de IDIOMAS', () => {
    expect(listaAGuardar(false, ['pt', 'en'])).toEqual(['en', 'pt'])
    expect(listaAGuardar(false, ['es'])).toEqual(['es'])
  })

  it('NEGATIVO · Guardar deshabilitado con 0 idiomas elegidos', () => {
    expect(puedeGuardarIdiomas([], null, false)).toBe(false)
    expect(puedeGuardarIdiomas(['en'], null, false)).toBe(true)
    // Sin cambio, o guardando, tampoco.
    expect(puedeGuardarIdiomas(['en'], ['en'], false)).toBe(false)
    expect(puedeGuardarIdiomas(['en'], null, true)).toBe(false)
    expect(puedeGuardarIdiomas(null, ['en'], false)).toBe(true)
  })
})

describe('IdiomasServidorPanel · lo que se pinta', () => {
  it('con «servidor»: las 4 deshabilitadas, mostrando las activas', () => {
    const c = casillas(pintar({ idiomas: null, activos: ['es', 'en'] }))
    expect(c.map((x) => x.idioma)).toEqual(['es', 'en', 'it', 'pt'])
    expect(c.every((x) => x.deshabilitada)).toBe(true)
    expect(c.filter((x) => x.marcada).map((x) => x.idioma)).toEqual(['es', 'en'])
  })

  it('con idiomas guardados sin espanol: marcados los guardados y el espanol HABILITADO y sin marcar', () => {
    const html = pintar({ idiomas: ['en', 'pt'], activos: ['en', 'pt'] })
    const c = casillas(html)
    expect(c.filter((x) => x.marcada).map((x) => x.idioma)).toEqual(['en', 'pt'])
    expect(c.every((x) => !x.deshabilitada)).toBe(true)
    // Ya no hay «(siempre)» junto al espanol.
    expect(html).not.toContain('(siempre)')
  })
})
