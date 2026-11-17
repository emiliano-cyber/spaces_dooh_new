import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProveedorIdioma } from './contexto'
import type { Idioma } from './idiomas'
import { ES_CRM } from './textos/crm'
import { CotejoPorCliente } from '@/components/demo/propuestas/CotejoPorCliente'
import type { Propuesta } from '@/lib/data/client'

// ============================================================================
//  El cotejo por cliente (CRM, Fase 1 del ADR 0051), rendido de verdad.
// ----------------------------------------------------------------------------
//  Mismo patrón que `pantallas-propuestas.test.ts`: el componente REAL dentro
//  del proveedor de idioma, a HTML con `renderToStaticMarkup`. Comprueba que en
//  español salen las cifras del cotejo y que en los otros tres idiomas no se
//  cuela ninguna frase española del área.
// ============================================================================

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  usePathname: () => '/propuestas',
  useSearchParams: () => new URLSearchParams(),
}))

const prop = (o: Partial<Propuesta> & Pick<Propuesta, 'id'>): Propuesta =>
  ({
    folio: o.id.toUpperCase(),
    nombre: `Campaña ${o.id}`,
    clienteId: 'c1',
    agenciaId: null,
    estatus: 'ENVIADA',
    version: 1,
    creadoEn: '2026-11-01T18:00:00.000Z',
    aprobadaEn: null,
    rechazadaEn: null,
    vendedorNombre: 'Ana',
    total: 1160,
    totalAprobado: 0,
    items: [],
    ...o,
  }) as Propuesta

const PROPS = [
  prop({ id: 'p1', version: 3 }),
  prop({ id: 'p2', estatus: 'APROBADA', aprobadaEn: '2026-11-05T18:00:00.000Z', totalAprobado: 2320 }),
  prop({ id: 'p3', clienteId: null }),
]
const CLIENTES = [{ id: 'c1', nombre: 'Refrescos del Norte' }] as any

const rendir = (idioma: Idioma) =>
  renderToStaticMarkup(
    createElement(ProveedorIdioma, { idioma, puedeElegir: true }, createElement(CotejoPorCliente, { propuestas: PROPS, clientes: CLIENTES })),
  )

describe('CotejoPorCliente', () => {
  it('en español: un grupo por cliente, con sus cotizaciones y renegociaciones', () => {
    const html = rendir('es')
    expect(html).toContain('Refrescos del Norte')
    expect(html).toContain('Sin cliente')
    expect(html).toContain('Cotizaciones')
    expect(html).toContain('Renegociaciones')
    expect(html).toContain('En negociación')
    expect(html).toContain('2 clientes')
  })

  it('sin propuestas, el aviso y no una tabla vacía', () => {
    const html = renderToStaticMarkup(
      createElement(ProveedorIdioma, { idioma: 'es', puedeElegir: true }, createElement(CotejoPorCliente, { propuestas: [], clientes: [] })),
    )
    expect(html).toContain(ES_CRM['crm.cotejo.vacio'])
  })

  // Las frases que se pintan en el estado de arriba; las que comparten
  // palabra con otro idioma («Vendedores» en pt) se dejan fuera a propósito.
  const ESPANOL = [
    ES_CRM['crm.cotejo.col.cotizaciones'],
    ES_CRM['crm.cotejo.col.renegociaciones'],
    ES_CRM['crm.cotejo.col.dias'],
    ES_CRM['crm.cotejo.col.en-juego'],
    ES_CRM['crm.cotejo.col.ganado'],
    ES_CRM['crm.cotejo.col.cierre'],
    ES_CRM['crm.cotejo.sin-cliente'],
    'Primera cotización',
    'Última actividad',
  ]

  for (const idioma of ['en', 'it', 'pt'] as Idioma[]) {
    it(`en ${idioma} no queda ninguna frase española del cotejo`, () => {
      const html = rendir(idioma)
      expect(ESPANOL.filter((f) => html.includes(f))).toEqual([])
      expect(html).toContain('Refrescos del Norte')
    })
  }
})
