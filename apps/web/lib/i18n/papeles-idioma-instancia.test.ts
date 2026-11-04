import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { traducir } from './diccionario'

// ============================================================================
//  ADR 0049 (segunda vuelta) · LOS PAPELES DEL CLIENTE, EN EL IDIOMA DE LA
//  INSTANCIA. Decision del dueno (03/11): «todo debe salir en el idioma que se
//  configuro el programa».
//
//   · La liga publica de la propuesta (`/p/[id]`) y el portal del cliente
//     (`/portal/[token]`): su `layout.tsx` re-provee el idioma con el de la
//     instancia, sin importar el navegador de quien abre el enlace.
//   · El comprobante de cobranza: el papel en el idioma de la instancia; los
//     botones del cuadro (no se imprimen), en el de la persona.
// ============================================================================

const instancia = vi.hoisted(() => ({ idioma: 'es' as 'es' | 'en' | 'it' }))
vi.mock('@/lib/server/idioma-instancia', () => ({ idiomaDeLaInstancia: async () => instancia.idioma }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }))
// El cuadro real va por un portal de Radix, que en el servidor no pinta nada.
vi.mock('@/components/demo/ui/Modal', () => ({
  Modal: ({ title, children, footer }: { title: string; children: unknown; footer: unknown }) =>
    h('div', null, h('h2', null, title), children as never, footer as never),
}))

const { ProveedorIdioma, useIdioma } = await import('./contexto')
const { ProveedorIdiomaDocumentos } = await import('./idioma-documentos-cliente')

function Sonda() {
  return h('i', null, `papel:${useIdioma().idioma}`)
}

describe.each([
  ['la liga publica de la propuesta', '../../app/(app)/p/[id]/layout'],
  ['el portal del cliente', '../../app/(app)/portal/[token]/layout'],
])('%s va en el idioma de la instancia', (_n, ruta) => {
  it.each([
    ['en', 'es'],
    ['es', 'en'],
    ['en', 'it'],
  ] as const)('navegador en %s, instancia en %s', async (persona, deLaInstancia) => {
    instancia.idioma = deLaInstancia
    const { default: Layout } = await import(ruta)
    const html = renderToStaticMarkup(
      h(ProveedorIdioma, { idioma: persona, puedeElegir: true }, await Layout({ children: h(Sonda) })),
    )
    expect(html).toContain(`papel:${deLaInstancia}`)
    // B68 · el contenido declara el idioma de la instancia (el <html> sigue
    // con el de la peticion: lo pone el layout raiz).
    expect(html).toContain(`<div lang="${deLaInstancia}" style="display:contents">`)
  })
})

describe('el comprobante de cobranza', () => {
  const FACTURA = {
    id: 'f1', folio: 'F001-AB', folioFiscal: null, serie: null, fechaEmision: '2026-11-01', estatus: 'EMITIDA',
    campanaId: 'c1', entidadEmisoraId: null, razonSocial: 'Cliente SA', rfc: 'CLI010101AAA', usoCfdi: 'G03',
    subtotal: 100, igv: 16, monto: 116, moneda: 'MXN',
  }

  async function pintar(persona: 'es' | 'en', deLaInstancia: 'es' | 'en' | 'it' | null) {
    const { ComprobanteDialog } = await import('@/components/demo/finanzas/ComprobanteDialog')
    const dialogo = h(ComprobanteDialog, {
      factura: FACTURA as never,
      campanas: [{ id: 'c1', nombre: 'Navidad' }],
      entidades: [],
      onOpenChange: () => {},
      formatMonto: (n: number) => `$${n}`,
    })
    const conPersona = h(ProveedorIdioma, { idioma: persona }, dialogo)
    return renderToStaticMarkup(deLaInstancia ? h(ProveedorIdiomaDocumentos, { idioma: deLaInstancia }, conPersona) : conPersona)
  }

  it('instancia ESPANOLA, persona en ingles: el papel en espanol, los botones en ingles', async () => {
    const html = await pintar('en', 'es')
    expect(html).toContain(traducir('es', 'finanzas.comprobante.la-recibe'))
    expect(html).toContain(traducir('es', 'finanzas.comprobante.aviso'))
    expect(html).toContain(traducir('es', 'finanzas.comprobante.titulo', { folio: 'F001-AB' }))
    expect(html).not.toContain(traducir('en', 'finanzas.comprobante.la-recibe'))
    expect(html).toContain(traducir('en', 'finanzas.comprobante.imprimir'))
    // «Sin asignar» del emisor tambien es del papel.
    expect(html).toContain('Sin asignar')
  })

  it('instancia INGLESA, persona en espanol: el papel en ingles, los botones en espanol', async () => {
    const html = await pintar('es', 'en')
    expect(html).toContain(traducir('en', 'finanzas.comprobante.la-recibe'))
    expect(html).not.toContain(traducir('es', 'finanzas.comprobante.la-recibe'))
    expect(html).toContain(traducir('es', 'finanzas.comprobante.imprimir'))
  })
})
