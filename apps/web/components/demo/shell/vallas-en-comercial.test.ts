import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProveedorIdioma } from '@/lib/i18n/contexto'
import type { RolDemo } from '@/lib/data/types'
import { ROLES_ASIGNABLES } from '@/lib/roles'
import { NAV, rutasDe } from './nav'

// ============================================================================
//  Vallas, SOLO en Comercial (pedido del dueño, 20/11).
// ----------------------------------------------------------------------------
//  El 19/11 Vallas quedó en DOS sitios del menú: en Inventario y, como
//  «espejo», en Comercial. Al verlo en el navegador el 20/11 el dueño pidió:
//  «hay 2 menús de vallas, cámbialo a que solo haya uno, es en Comercial».
//
//  Lo que estas pruebas fijan:
//   · una sola entrada lleva a /vallas, y está en Comercial, después de
//     Disponibilidad;
//   · Inventario ya no la tiene;
//   · la ven los mismos que antes (mando y venta) y nadie más;
//   · el menú REAL la pinta una sola vez, en Comercial, con «En proceso».
// ============================================================================

const MANDO: RolDemo[] = ['DUENO', 'ADMINISTRADOR']
const VENTA: RolDemo[] = ['DIRECTOR_COMERCIAL', 'GERENTE_VENTAS', 'VENDEDOR']
const ROLES: RolDemo[] = ROLES_ASIGNABLES.map((r) => r.value)
const paraRol = (rol: RolDemo) => NAV.filter((n) => n.roles.includes(rol))

describe('Vallas solo en Comercial · el dato del menú', () => {
  it('una sola entrada lleva a /vallas: la de Comercial, justo después de Disponibilidad', () => {
    const conVallas = NAV.filter((n) => rutasDe(n).includes('/vallas'))
    expect(conVallas.map((n) => n.key)).toEqual(['vallas'])
    const vallas = conVallas[0]
    expect(vallas.grupo).toBe('vender')
    expect(vallas.espejoDe).toBeUndefined()
    expect(vallas.insignia).toBe('en-proceso')
    const i = (k: string) => NAV.findIndex((n) => n.key === k)
    expect(i('vallas')).toBe(i('disponibilidad') + 1)
  })

  it('Inventario ya no la tiene', () => {
    expect(NAV.filter((n) => n.grupo === 'patrimonio').map((n) => n.href)).not.toContain('/vallas')
  })

  it('la ven mando y venta, y nadie más', () => {
    for (const rol of ROLES) {
      const ve = paraRol(rol).some((n) => n.href === '/vallas')
      expect(ve, rol).toBe([...MANDO, ...VENTA].includes(rol))
    }
  })
})

// ─── El menú REAL, pintado para cada rol ────────────────────────────────────
let rolActual: RolDemo = 'DUENO'
vi.mock('./SesionContext', () => ({
  useSesionCtx: () => ({ sesion: { usuario: { rol: rolActual } } }),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/vallas',
}))
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
})

async function pintarSidebar(rol: RolDemo): Promise<string> {
  rolActual = rol
  const { Sidebar } = await import('./Sidebar')
  const { MenuMovilProvider } = await import('./MenuMovilContext')
  return renderToStaticMarkup(
    createElement(ProveedorIdioma, { idioma: 'es' }, createElement(MenuMovilProvider, null, createElement(Sidebar))),
  )
}

// El cuerpo de una sección del menú expandido (desktop: el primero que se pinta).
function seccion(html: string, grupo: string): string {
  const ini = html.indexOf(`id="menu-seccion-${grupo}"`)
  expect(ini, `no se pintó la sección ${grupo}`).toBeGreaterThan(-1)
  return html.slice(ini, html.indexOf('</ul>', ini))
}

describe.each([...MANDO, ...VENTA])('el menú pintado para %s', (rol) => {
  it('Comercial lleva Vallas, con «En proceso», después de Disponibilidad', async () => {
    const comercial = seccion(await pintarSidebar(rol), 'vender')
    const iVallas = comercial.indexOf('href="/vallas"')
    expect(iVallas, 'Vallas no está en Comercial').toBeGreaterThan(-1)
    expect(comercial.indexOf('href="/disponibilidad"')).toBeLessThan(iVallas)
    const li = comercial.slice(comercial.lastIndexOf('<li', iVallas), comercial.indexOf('</li>', iVallas))
    expect(li).toContain('>Vallas<')
    expect(li).toContain('>En proceso<')
  })

  it('e Inventario ya no la lleva', async () => {
    // Venta también ve Inventario (Prospección, Network): la sección existe para todos.
    expect(seccion(await pintarSidebar(rol), 'patrimonio')).not.toContain('href="/vallas"')
  })
})
