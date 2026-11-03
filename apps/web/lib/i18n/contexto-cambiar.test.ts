import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Idioma } from './idiomas'

// ============================================================================
//  Lote L5 del italiano (2026-11-03) · el V6 del validador de la ola 0.
//  `cambiarIdioma` ignora un idioma que el servidor no ofrece: con el italiano
//  apagado, llamarlo con 'it' no escribe la cookie ni refresca. Sin esta
//  prueba, el mutante que quitaba `!disponibles.includes(nuevo)` sobrevivia.
// ============================================================================

const router = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: router.refresh }),
  usePathname: () => '/inicio',
}))

let documento: { cookie: string }
beforeEach(() => {
  router.refresh.mockReset()
  documento = { cookie: '' }
  vi.stubGlobal('document', documento)
  vi.stubGlobal('window', { location: { protocol: 'http:' } })
})
afterEach(() => {
  vi.unstubAllGlobals()
})

async function cambiarCon(disponibles: readonly Idioma[], nuevo: Idioma): Promise<void> {
  const { ProveedorIdioma, useIdioma } = await import('./contexto')
  let cambiar: ((i: Idioma) => void) | null = null
  function Sonda() {
    cambiar = useIdioma().cambiarIdioma
    return null
  }
  renderToStaticMarkup(createElement(ProveedorIdioma, { idioma: 'es', puedeElegir: true, disponibles }, createElement(Sonda)))
  try {
    cambiar!(nuevo)
  } catch {
    // `setIdioma` fuera del render del servidor puede quejarse; lo que se
    // mira aqui es la cookie y el refresco, que van antes.
  }
}

describe('cambiarIdioma respeta los idiomas que ofrece el servidor', () => {
  it('con el italiano apagado, pedir italiano no hace nada', async () => {
    await cambiarCon(['es', 'en'], 'it')
    expect(documento.cookie).toBe('')
    expect(router.refresh).not.toHaveBeenCalled()
  })

  it('un idioma ofrecido si escribe la cookie y refresca (la prueba mira algo)', async () => {
    await cambiarCon(['es', 'en'], 'en')
    expect(documento.cookie).toContain('spaces_idioma=en')
    expect(router.refresh).toHaveBeenCalledTimes(1)
  })

  it('con el italiano encendido, el italiano tambien', async () => {
    await cambiarCon(['es', 'it'], 'it')
    expect(documento.cookie).toContain('spaces_idioma=it')
  })
})
