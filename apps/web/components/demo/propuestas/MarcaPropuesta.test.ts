import { describe, it, expect, vi, afterEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProveedorIdioma } from '@/lib/i18n/contexto'
import type { Idioma } from '@/lib/i18n/idiomas'
import { AvisoMarcaCliente, BloqueMarcaPropuesta } from './MarcaPropuesta'
import { actualizarPropuestaApi } from '@/lib/data/estado-api'

// ============================================================================
//  PROP-MARCA · decisiones del dueño del 20/11:
//   1. La marca se edita desde la ficha de la propuesta, con las mismas
//      reglas que las condiciones (quien puede crear propuestas, y no en una
//      APROBADA). Al guardar, los avisos de competencia que devuelve el PATCH
//      van al recuadro ámbar de la ficha.
//   3. Si la marca escrita no se parece al cliente, un aviso INFORMATIVO
//      (suave, no el ámbar de competencia, y no bloquea nada).
// ============================================================================

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function pintar(idioma: Idioma, el: ReturnType<typeof createElement>) {
  return renderToStaticMarkup(
    createElement(ProveedorIdioma, { idioma, puedeElegir: true, disponibles: ['es', 'en', 'it', 'pt'] }, el),
  )
}

describe('AvisoMarcaCliente', () => {
  it('marca distinta del cliente → el aviso, con las dos nombradas', () => {
    const html = pintar('es', createElement(AvisoMarcaCliente, { marca: 'Pepsi', cliente: 'Publicis México' }))
    expect(html).toContain('data-testid="aviso-marca-cliente"')
    expect(html).toContain('La marca «Pepsi» no coincide con el cliente «Publicis México». Revisa que sea correcta.')
  })

  it('es informativo: no lleva el ámbar de la competencia', () => {
    const html = pintar('es', createElement(AvisoMarcaCliente, { marca: 'Pepsi', cliente: 'Publicis México' }))
    expect(html).not.toContain('bg-warning')
    expect(html).not.toContain('data-testid="aviso-competencia"')
  })

  it('coincidentes, sin marca o sin cliente → no pinta nada', () => {
    expect(pintar('es', createElement(AvisoMarcaCliente, { marca: 'Coca-Cola', cliente: 'Coca Cola FEMSA' }))).toBe('')
    expect(pintar('es', createElement(AvisoMarcaCliente, { marca: '', cliente: 'Publicis México' }))).toBe('')
    expect(pintar('es', createElement(AvisoMarcaCliente, { marca: 'Pepsi', cliente: null }))).toBe('')
  })

  it('en los cuatro idiomas', () => {
    const p = { marca: 'Pepsi', cliente: 'Publicis' }
    expect(pintar('en', createElement(AvisoMarcaCliente, p))).toContain('The brand “Pepsi” does not match the client “Publicis”. Check that it is correct.')
    expect(pintar('it', createElement(AvisoMarcaCliente, p))).toContain('Il marchio «Pepsi» non corrisponde al cliente «Publicis». Verifica che sia corretto.')
    expect(pintar('pt', createElement(AvisoMarcaCliente, p))).toContain('A marca “Pepsi” não coincide com o cliente “Publicis”. Verifique se está correta.')
  })
})

describe('BloqueMarcaPropuesta (la ficha)', () => {
  const base = { propuestaId: 'p1', marca: 'Pepsi', cliente: 'Publicis México', onAvisos: () => {} }

  it('editable → campo con la marca guardada y botón Guardar', () => {
    const html = pintar('es', createElement(BloqueMarcaPropuesta, { ...base, editable: true }))
    expect(html).toContain('data-testid="editar-marca"')
    expect(html).toContain('value="Pepsi"')
    expect(html).toContain('Guardar')
    // Y el aviso de que no coincide, con lo que hay escrito.
    expect(html).toContain('data-testid="aviso-marca-cliente"')
  })

  it('no editable → sin campo ni botón, pero el aviso sigue', () => {
    const html = pintar('es', createElement(BloqueMarcaPropuesta, { ...base, editable: false }))
    expect(html).not.toContain('data-testid="editar-marca"')
    expect(html).not.toContain('Guardar')
    expect(html).toContain('data-testid="aviso-marca-cliente"')
  })

  it('no editable y coincidente → no pinta nada', () => {
    expect(
      pintar('es', createElement(BloqueMarcaPropuesta, { ...base, marca: 'Publicis', editable: false })),
    ).toBe('')
  })

  it('en italiano la etiqueta es «Marchio»', () => {
    const html = pintar('it', createElement(BloqueMarcaPropuesta, { ...base, editable: true }))
    expect(html).toContain('Marchio')
  })
})

describe('actualizarPropuestaApi devuelve los avisos del PATCH', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('con avisosCompetencia en la respuesta, los entrega a quien guardó', async () => {
    const aviso = { regla: 'competencia-marcas', nivel: 'aviso', marca: 'Pepsi', marcaExistente: 'Coca-Cola' }
    const llamadas: { url: string; init?: RequestInit }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        llamadas.push({ url, init })
        if (url.includes('/estado/')) return new Response('{}', { status: 200 })
        return new Response(JSON.stringify({ id: 'p1', marca: 'Pepsi', avisosCompetencia: [aviso] }), { status: 200 })
      }),
    )
    const r = await actualizarPropuestaApi('p1', { marca: 'Pepsi' })
    expect(r.avisosCompetencia).toEqual([aviso])
    expect(JSON.parse(String(llamadas[0].init?.body))).toEqual({ marca: 'Pepsi' })
  })

  it('sin avisos en la respuesta (otro campo) → lista vacía', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: 'p1' }), { status: 200 })))
    const r = await actualizarPropuestaApi('p1', { nombre: 'X' })
    expect(r.avisosCompetencia).toEqual([])
  })
})
