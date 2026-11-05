import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DICCIONARIOS, PT_PARCIAL, traducir, type ClaveTexto } from './diccionario'
import { PT_PAPELES } from './textos/papeles-portugues'
import { PT_PROPUESTAS } from './textos/propuestas'
import { PT_CUENTA } from './textos/cuenta'
import { PT_FINANZAS } from './textos/finanzas'
import { PT_ARRENDADORES } from './textos/arrendadores'
import { PT_NOTIFICACIONES } from './textos/notificaciones'
import { PT_CAMPANAS } from './textos/campanas'
import { PT_COMERCIAL } from './textos/comercial'
import { ConstanciaFirmas } from '@/components/demo/arrendadores/ConstanciaFirmas'
import { asuntoCorreoReset, htmlCorreoReset, asuntoCorreoInvitacion, htmlCorreoInvitacion } from '@/lib/server/email'
import { asuntoCorreoPropuesta, htmlCorreoPropuesta } from '@/lib/server/propuesta-correo'
import { importeDeRevision } from '@/components/demo/arrendadores/PanelFirmas'
import { generarContrato, documentoATexto } from '@/lib/contrato-documento'
import { completo } from '@/lib/contrato-documento.datos-prueba'

// ============================================================================
//  P3 del portugues (05/11) · LOS PAPELES EN PORTUGUES.
//
//  En una instancia con documentos en `pt` (ADR 0049), los papeles salen en
//  portugues: constancia de firmas, propuesta imprimible, `/p`, portal,
//  comprobante y correos. Sus claves viven en `textos/papeles-portugues.ts`
//  (aparte de los `PT_<AMBITO>` de los lotes, que se traducen en paralelo).
//
//  Lo que se protege:
//   · que TODA clave de papel tenga portugues escrito (la caida al espanol del
//     portugues no se nota a simple vista: aqui si);
//   · la COSTURA con los lotes: si un lote escribe una de estas claves
//     distinta, rojo;
//   · que es/en/it no cambien: ninguna clave de papel toca esos diccionarios.
// ============================================================================

const ES = DICCIONARIOS.es as Record<string, string>
const PT = DICCIONARIOS.pt as Record<string, string>

// Las claves de cada papel. Si un papel gana una clave, va aqui.
const PAPELES: Array<[string, RegExp]> = [
  ['constancia de firmas', /^arrendadores\.constancia\./],
  ['propuesta imprimible', /^propuestas\.documento\.(qr\.|encabezado|para|periodo|vigencia|aceptada|vencio|valida-hasta|se-fija|pantallas|col\.|sin-foto|franja|ubicacion|sin-coords|importe|descuento|comision|terminos|acepta-cliente|firma)/],
  ['liga publica /p', /^cuenta\.publica\./],
  ['portal del cliente', /^cuenta\.portal\./],
  ['comprobante', /^finanzas\.comprobante\.(titulo|la-recibe|uso|serie|fecha|subtotal|iva|no-cuadra|aviso)$/],
  ['correo de la propuesta', /^propuestas\.correo\./],
  ['correos de invitacion y reset', /^cuenta\.correo\./],
  ['correo diario de contratos', /^notificaciones\.(correo\.|contrato\.)/],
  ['etapas del portal', /^campanas\.etapa\./],
]

describe('P3 · toda clave de papel tiene portugues escrito', () => {
  it.each(PAPELES)('%s', (_n, patron) => {
    const claves = Object.keys(ES).filter((k) => patron.test(k))
    expect(claves.length).toBeGreaterThan(0)
    const faltan = claves.filter((k) => !(PT_PARCIAL as Record<string, string>)[k])
    expect(faltan).toEqual([])
  })

  it('NEGATIVO · lo que se lee del papel ya no es el espanol (muestras)', () => {
    for (const k of [
      'arrendadores.constancia.titulo',
      'propuestas.documento.encabezado',
      'propuestas.documento.acepta-cliente',
      'cuenta.publica.aceptar',
      'cuenta.portal.subtitulo',
      'finanzas.comprobante.aviso',
      'cuenta.correo.reset.asunto',
      'notificaciones.correo.contratos.titulo',
    ] as ClaveTexto[]) {
      expect(PT[k], k).not.toBe(ES[k])
    }
  })

  it('H4 (validacion de P3) · «certificado de conservação NOM-151», no «constância»', () => {
    expect(PT['arrendadores.constancia.nota']).toContain('certificado de conservação NOM-151')
    expect(PT['arrendadores.constancia.nota']).not.toContain('constância')
  })

  it('el rol «Dueño» se dice «Titular» (dueno, 05/11): ningun papel dice «Proprietário» por el rol', () => {
    // El contrato dice «proprietário ou possuidor» del INMUEBLE (derecho
    // civil), no el rol de la aplicacion: ese no es el caso.
    for (const [k, v] of Object.entries(PT_PAPELES)) expect(v, k).not.toMatch(/propriet[aá]ri/i)
  })

  it('las partes de la constancia son las del contrato en portugues', () => {
    expect(PT['arrendadores.constancia.parte.arrendador']).toBe('O LOCADOR')
    expect(PT['arrendadores.constancia.parte.arrendatario']).toBe('O LOCATÁRIO')
  })

  it('cada clave de papel existe en espanol y lleva sus mismos huecos', () => {
    const huecos = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    for (const [k, v] of Object.entries(PT_PAPELES)) {
      expect(ES[k], k).toBeDefined()
      const esperados = k.endsWith('.cero') ? huecos(ES[k]).filter((x) => x !== 'n') : huecos(ES[k])
      expect(huecos(v!).filter((x) => !k.endsWith('.cero') || x !== 'n'), k).toEqual(esperados)
    }
  })
})

describe('P3 · la costura con los lotes', () => {
  const LOTES: Array<Partial<Record<string, string>>> = [
    PT_PROPUESTAS, PT_CUENTA, PT_FINANZAS, PT_ARRENDADORES, PT_NOTIFICACIONES, PT_CAMPANAS, PT_COMERCIAL,
  ]
  it('si un lote escribe una clave de papel, tiene que decir LO MISMO (o se decide y se quita de aqui)', () => {
    const choques: string[] = []
    for (const lote of LOTES) {
      for (const [k, v] of Object.entries(lote)) {
        const papel = (PT_PAPELES as Record<string, string>)[k]
        if (papel !== undefined && v && v !== papel) choques.push(`${k}: lote «${v}» / papel «${papel}»`)
      }
    }
    expect(choques).toEqual([])
  })
})

describe('P3 · es/en/it no se tocan', () => {
  // Que los diccionarios es/en/it no cambiaron lo mide el volcado HTML de toda
  // la suite antes/despues (diario del 05/11); aqui, que los papeles solo
  // entran en el PORTUGUES: el espanol, el ingles y el italiano de una clave de
  // papel siguen siendo los de su `textos/<ambito>.ts`.
  it('ninguna clave de papel escrita en pt aparece en es/en/it salvo donde la palabra es la misma', () => {
    const iguales = Object.keys(PT_PAPELES).filter((k) => traducir('es', k as ClaveTexto) === PT[k])
    // Palabras que el portugues escribe igual que el espanol («Total», «IVA»,
    // «Reservada»…): no son una caida, son la misma palabra.
    for (const k of iguales) expect(PT[k], k).toMatch(/^(Total|IVA|Subtotal|Mural|Reservada|Confirmada|Publicada|Anunciante|Para|foto|Navegador: \{navegador\}|Uso: \{uso\}|Total|Contrato vencido: \{contrato\}|\{n\} vencidos?|Código \{codigo\} \(\{pct\}%\)|IVA \{pct\}%)$/)
    expect(DICCIONARIOS.es['arrendadores.constancia.titulo']).toBe('Constancia de firma electrónica')
    expect(DICCIONARIOS.en['arrendadores.constancia.titulo']).toBe('Electronic signature certificate')
  })
})

describe('P3 · los papeles pintados en portugues', () => {
  const FIRMA = {
    parte: 'ARRENDADOR' as const,
    estatus: 'FIRMADA' as const,
    nombreFirmante: 'Juan Pérez',
    firmadoEn: '2026-11-05T15:00:00Z',
    ip: '10.0.0.1',
    userAgent: null,
    documentoHash: 'abc',
    invalidada: true,
  }

  it('la constancia de firmas, en portugues, con la fecha a la brasileña', () => {
    const html = renderToStaticMarkup(
      h(ConstanciaFirmas, { estado: { firmas: [FIRMA], hashCongelado: 'abc', congeladoEn: '2026-11-05T15:00:00Z' } as never, idioma: 'pt' }),
    )
    expect(html).toContain('Comprovante de assinatura eletrônica')
    expect(html).toContain('O LOCADOR')
    expect(html).toContain('ASSINATURA INVALIDADA')
    expect(html).toContain('não registrado')
    expect(html).toContain('de novembro de 2026')
    expect(html).not.toContain('Constancia de firma')
  })

  it('el correo de restablecer contrasena, en portugues', () => {
    expect(asuntoCorreoReset('pt')).toBe('Redefina sua senha · Space OS')
    const html = htmlCorreoReset('Ana', 'https://x.test/r/1', 'pt')
    expect(html).toContain('Olá, Ana')
    expect(html).toContain('Redefinir senha')
    expect(html).not.toContain('Restablece')
  })

  it('el correo de invitacion, en portugues', () => {
    expect(asuntoCorreoInvitacion('pt')).toBe('Você recebeu acesso ao Space OS · escolha sua senha')
    expect(htmlCorreoInvitacion('Ana', 'https://x.test/i/1', 'pt')).toContain('Escolher minha senha')
  })

  it('el correo de la propuesta, en portugues', () => {
    expect(asuntoCorreoPropuesta({ orgNombre: 'Org', propuestaNombre: 'Natal' }, 'pt')).toBe(
      'Proposta comercial: Natal · Org',
    )
    const html = htmlCorreoPropuesta(
      {
        orgNombre: 'Org', logoUrl: null, propuestaNombre: 'Natal', folio: 'P-1', liga: 'https://x.test/p/1',
        vigenteHasta: null, mensaje: null, remitenteNombre: null,
      } as never,
      'pt',
    )
    expect(html).toContain('Ver a proposta')
    expect(html).toContain('Nº P-1')
  })

  it('NEGATIVO · en una instancia espanola los correos siguen siendo los literales de siempre', () => {
    expect(asuntoCorreoReset('es')).toBe('Restablece tu contraseña · Space OS')
    expect(asuntoCorreoReset()).toBe('Restablece tu contraseña · Space OS')
  })
})

// H1 de la validacion de P3 (05/11): la revision previa a enviar a firma
// muestra el importe «como lo recita el contrato». Con la interfaz en
// portugues salia el formato mexicano («$1,234,567.89»), que en Brasil se lee
// al reves. El mismo arreglo que el italiano del 04/11.
describe('P3 · H1 · la revision previa a la firma, con el importe del contrato pt', () => {
  it('pt: «1.234.567,89 MXN», exactamente como lo dice el contrato en portugues', () => {
    expect(importeDeRevision(1234567.89, 'MXN', 'pt')).toBe('1.234.567,89 MXN')
    expect(importeDeRevision(6000, 'USD', 'pt')).toBe('6.000,00 USD')
    const texto = documentoATexto(generarContrato({ ...completo, idioma: 'pt' }))
    expect(texto).toContain(`${importeDeRevision(1234567.89, 'MXN', 'pt')} (`)
  })
  it('NEGATIVO · es/en/it como siempre, y sin importe no hay nada', () => {
    expect(importeDeRevision(6000, 'MXN', 'es')).toBe('$6,000.00 MXN')
    expect(importeDeRevision(6000, 'MXN', 'en')).toBe('$6,000.00 MXN')
    expect(importeDeRevision(6000, 'MXN', 'it')).toBe('6.000,00 MXN')
    expect(importeDeRevision(null, 'MXN', 'pt')).toBeNull()
  })
})
