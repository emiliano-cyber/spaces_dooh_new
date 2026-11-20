import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProveedorIdioma } from '@/lib/i18n/contexto'
import type { RolDemo } from '@/lib/data/types'
import { ROLES_ASIGNABLES } from '@/lib/roles'
import { NAV, rutasDe } from './nav'

// ============================================================================
//  «Vallas va igual en Comercial» (pedido del dueño, 19/11).
// ----------------------------------------------------------------------------
//  Vallas sigue en Inventario y sale TAMBIÉN en Comercial, después de
//  Disponibilidad: las vallas son lo que se vende, y el equipo comercial las
//  usa (p. ej. «Verificar una marca» antes de proponer).
//
//  Es la MISMA pantalla en dos grupos. El menú lo expresa con una entrada
//  ESPEJO (`espejoDe`) que copia href, rótulo, icono, roles e insignia de la
//  original. Lo que estas pruebas fijan es lo que puede romperse en silencio:
//   · que la compuerta (`AuthGate`) no pueda dudar de qué roles aplicar a
//     /vallas —todas las entradas con esa ruta llevan los MISMOS roles—;
//   · que la vea quien ve el grupo Comercial (mando y venta) y nadie más;
//   · que no salga dos veces en el MISMO grupo;
//   · que el menú REAL la pinte en la sección Comercial con su insignia.
// ============================================================================

const MANDO: RolDemo[] = ['DUENO', 'ADMINISTRADOR']
const VENTA: RolDemo[] = ['DIRECTOR_COMERCIAL', 'GERENTE_VENTAS', 'VENDEDOR']
const ROLES: RolDemo[] = ROLES_ASIGNABLES.map((r) => r.value)
const paraRol = (rol: RolDemo) => NAV.filter((n) => n.roles.includes(rol))

describe('Vallas en Comercial · el dato del menú', () => {
  const original = NAV.find((n) => n.key === 'vallas')!
  const espejo = NAV.find((n) => n.key === 'vallas-comercial')

  it('sigue en Inventario y sale TAMBIÉN en Comercial, justo después de Disponibilidad', () => {
    expect(original.grupo).toBe('patrimonio')
    expect(espejo, 'no hay entrada de Vallas en Comercial').toBeDefined()
    expect(espejo!.grupo).toBe('vender')
    const i = (k: string) => NAV.findIndex((n) => n.key === k)
    expect(i('vallas-comercial')).toBe(i('disponibilidad') + 1)
  })

  it('es la MISMA pantalla: copia href, rótulo, icono, roles e insignia de la original', () => {
    expect(espejo!.espejoDe).toBe('vallas')
    expect(espejo!.href).toBe(original.href)
    expect(espejo!.label).toBe(original.label)
    expect(espejo!.icon).toBe(original.icon)
    expect(espejo!.roles).toEqual(original.roles)
    expect(espejo!.insignia).toBe('en-proceso')
  })

  it('la ven mando y venta (los que ven Comercial), en los DOS grupos', () => {
    for (const rol of [...MANDO, ...VENTA]) {
      const suyas = paraRol(rol)
      expect(suyas.filter((n) => n.grupo === 'vender').map((n) => n.key), rol).toContain('vallas-comercial')
      expect(suyas.filter((n) => n.grupo === 'patrimonio').map((n) => n.key), rol).toContain('vallas')
    }
  })

  it('y nadie más: Operaciones, Finanzas e Imprenta no la ven en ningún grupo', () => {
    for (const rol of ROLES.filter((r) => ![...MANDO, ...VENTA].includes(r))) {
      expect(paraRol(rol).filter((n) => n.href === '/vallas').map((n) => n.key), rol).toEqual([])
    }
  })

  it('la compuerta no puede dudar: toda entrada con /vallas lleva los MISMOS roles, y el vendedor está', () => {
    const conVallas = NAV.filter((n) => rutasDe(n).includes('/vallas'))
    expect(conVallas.map((n) => n.key).sort()).toEqual(['vallas', 'vallas-comercial'])
    for (const n of conVallas) {
      expect(n.roles, n.key).toEqual(original.roles)
      expect(n.roles, n.key).toContain('VENDEDOR')
    }
  })

  it('ningún rol la ve dos veces en el MISMO grupo', () => {
    for (const rol of ROLES) {
      const grupos = paraRol(rol).filter((n) => n.href === '/vallas').map((n) => n.grupo)
      expect(new Set(grupos).size, rol).toBe(grupos.length)
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

  it('e Inventario la conserva', async () => {
    expect(seccion(await pintarSidebar(rol), 'patrimonio')).toContain('href="/vallas"')
  })

  it('en /vallas se encienden las dos: es la misma pantalla', async () => {
    const html = await pintarSidebar(rol)
    for (const g of ['patrimonio', 'vender']) {
      const s = seccion(html, g)
      const i = s.indexOf('href="/vallas"')
      expect(s.slice(s.lastIndexOf('<a', i), s.indexOf('>', i)), g).toContain('aria-current="page"')
    }
  })
})
